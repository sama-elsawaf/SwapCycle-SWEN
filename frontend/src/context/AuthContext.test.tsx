import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../api/auth';
import * as client from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { apiError, makeUser } from '../utils/testHelpers';
import { AuthProvider } from './AuthContext';

vi.mock('../api/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
}));

const api = vi.mocked(authApi);

let latest: ReturnType<typeof useAuth>;
function Probe() {
  latest = useAuth();
  return <p>{latest.status}</p>;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('asks the server who is logged in on start', async () => {
    api.getCurrentUser.mockResolvedValue(makeUser());
    renderProvider();
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(latest.user?.displayName).toBe('Sara');
  });

  it('treats a 401 as logged out', async () => {
    api.getCurrentUser.mockRejectedValue(apiError(401, 'UNAUTHORIZED', 'Please log in.'));
    renderProvider();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(latest.user).toBeNull();
  });

  it('logs in, updates the profile and logs out', async () => {
    api.getCurrentUser.mockRejectedValue(apiError(401, 'UNAUTHORIZED', 'Please log in.'));
    api.login.mockResolvedValue(makeUser());
    api.updateProfile.mockResolvedValue(makeUser({ displayName: 'Sara K' }));
    api.logout.mockResolvedValue(undefined);
    renderProvider();
    await screen.findByText('anonymous');

    await act(() => latest.login('sara@example.com', 'password123'));
    expect(api.login).toHaveBeenCalledWith({ email: 'sara@example.com', password: 'password123' });
    expect(latest.status).toBe('authenticated');

    await act(() => latest.updateProfile({ displayName: 'Sara K' }));
    expect(latest.user?.displayName).toBe('Sara K');

    await act(() => latest.logout());
    expect(latest.status).toBe('anonymous');
  });

  it('logs out locally even if the server call fails', async () => {
    api.getCurrentUser.mockResolvedValue(makeUser());
    api.logout.mockRejectedValue(new TypeError('Failed to fetch'));
    renderProvider();
    await screen.findByText('authenticated');
    await act(async () => {
      await latest.logout().catch(() => undefined);
    });
    await waitFor(() => expect(latest.status).toBe('anonymous'));
  });

  it('logs out when any request finds the session expired', async () => {
    api.getCurrentUser.mockResolvedValue(makeUser());
    const handlers: Array<(() => void) | null> = [];
    const spy = vi.spyOn(client, 'setUnauthorizedHandler').mockImplementation((handler) => {
      handlers.push(handler);
    });
    renderProvider();
    await screen.findByText('authenticated');
    act(() => handlers.find(Boolean)?.());
    expect(latest.status).toBe('anonymous');
    spy.mockRestore();
  });

  it('wipes what SwapCycle kept on this device when logging out', async () => {
    api.getCurrentUser.mockResolvedValue(makeUser());
    api.logout.mockResolvedValue(undefined);
    localStorage.setItem('swapcycle:v1:recent-searches', '["q=dune"]');
    localStorage.setItem('swapcycle:v1:draft:book', '{}');
    localStorage.setItem('another-site-key', 'keep');
    renderProvider();
    await screen.findByText('authenticated');
    await act(() => latest.logout());
    expect(localStorage.getItem('swapcycle:v1:recent-searches')).toBeNull();
    expect(localStorage.getItem('swapcycle:v1:draft:book')).toBeNull();
    expect(localStorage.getItem('another-site-key')).toBe('keep');
  });

  it('never stores session data in browser storage', async () => {
    api.getCurrentUser.mockResolvedValue(makeUser());
    api.login.mockResolvedValue(makeUser());
    renderProvider();
    await screen.findByText('authenticated');
    await act(() => latest.login('sara@example.com', 'password123'));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('useAuth', () => {
  it('fails loudly outside the provider', () => {
    // Keep the expected error out of the test output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', swallow);
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    window.removeEventListener('error', swallow);
    spy.mockRestore();
  });
});
