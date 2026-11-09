import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../../api/auth';
import { AuthProvider } from '../../context/AuthContext';
import { resetMeetingAreasCache } from '../../hooks/useMeetingAreas';
import { apiError, makeUser } from '../../utils/testHelpers';
import Login from './Login';
import Onboarding from './Onboarding';
import Register from './Register';

vi.mock('../../api/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  listMeetingAreas: vi.fn(),
}));

const api = vi.mocked(authApi);

function renderAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/home" element={<p>home page</p>} />
          <Route path="/books/new" element={<p>add book page</p>} />
          <Route path="/my-books" element={<p>my books page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetMeetingAreasCache();
  api.getCurrentUser.mockRejectedValue(apiError(401, 'UNAUTHORIZED', 'Please log in.'));
  api.listMeetingAreas.mockResolvedValue([
    { id: 1, name: 'Main Library' },
    { id: 2, name: 'Student Union' },
  ]);
});

describe('Login', () => {
  it('validates before calling the server', async () => {
    renderAt('/login');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('shows the generic server message on bad credentials', async () => {
    api.login.mockRejectedValue(apiError(401, 'UNAUTHORIZED', 'Invalid email or password'));
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'sara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('returns to the page the reader came from', async () => {
    api.login.mockResolvedValue(makeUser());
    renderAt('/login', { from: '/my-books' });
    await userEvent.type(screen.getByLabelText('Email'), 'sara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText('my books page')).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith({ email: 'sara@example.com', password: 'password123' });
  });

  it('never follows an off-site return path', async () => {
    api.login.mockResolvedValue(makeUser());
    renderAt('/login', { from: '//evil.example/phish' });
    await userEvent.type(screen.getByLabelText('Email'), 'sara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('toggles password visibility with an accessible button', async () => {
    renderAt('/login');
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows social sign-in as not yet available', () => {
    renderAt('/login');
    expect(screen.getByRole('button', { name: /Google \(coming soon\)/ })).toBeDisabled();
  });
});

describe('Register', () => {
  it('checks the password length and then creates the account', async () => {
    api.register.mockResolvedValue(makeUser({ onboardingCompleted: false }));
    renderAt('/register');
    await userEvent.type(screen.getByLabelText('Display name'), 'Sara');
    await userEvent.type(screen.getByLabelText('Email'), 'sara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Password'), '-and-longer');
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() =>
      expect(api.register).toHaveBeenCalledWith({
        displayName: 'Sara',
        email: 'sara@example.com',
        password: 'short-and-longer',
      }),
    );
  });
});

describe('Onboarding', () => {
  it('saves interests, meeting area and privacy, then offers next steps', async () => {
    api.getCurrentUser.mockResolvedValue(makeUser({ onboardingCompleted: false }));
    api.updateProfile.mockResolvedValue(makeUser({ onboardingCompleted: true }));
    renderAt('/onboarding');

    await userEvent.click(await screen.findByRole('button', { name: 'Fiction' }));
    await userEvent.click(screen.getByRole('button', { name: 'Science' }));
    await userEvent.click(screen.getByRole('button', { name: 'Science' }));
    expect(screen.getByRole('button', { name: 'Fiction' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Science' })).toHaveAttribute('aria-pressed', 'false');

    await screen.findByRole('option', { name: 'Student Union' });
    await userEvent.selectOptions(screen.getByLabelText('Preferred Meeting Area'), '2');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));

    await userEvent.click(screen.getByLabelText('Show my reading interests'));
    await userEvent.click(screen.getByRole('button', { name: /Save and continue/ }));

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith({
        interests: ['FICTION'],
        meetingAreaId: 2,
        privacy: { showMeetingArea: true, showInterests: false },
        onboardingCompleted: true,
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'List a book' }));
    expect(screen.getByText('add book page')).toBeInTheDocument();
  });
});
