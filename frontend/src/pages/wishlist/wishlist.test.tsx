import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as wishlistApi from '../../api/wishlist';
import type { WishItem } from '../../types';
import { makeUser } from '../../utils/testHelpers';
import AddWishItem from './AddWishItem';
import WishList from './WishList';

vi.mock('../../api/wishlist', () => ({
  listWishItems: vi.fn(),
  addWishItem: vi.fn(),
  removeWishItem: vi.fn(),
  updateWishItem: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: makeUser(), status: 'authenticated' }) }));

const api = vi.mocked(wishlistApi);

function wish(id: string, overrides: Partial<WishItem> = {}): WishItem {
  return {
    id,
    kind: 'TITLE',
    title: id,
    author: null,
    genre: null,
    language: null,
    minCondition: null,
    priority: 'MEDIUM',
    fulfilled: false,
    fulfilledAt: null,
    createdAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/wishlist" element={<WishList />} />
        <Route path="/wishlist/new" element={<AddWishItem />} />
      </Routes>
    </MemoryRouter>,
  );
}

const section = (name: RegExp) => screen.getByRole('region', { name });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('WishList', () => {
  it('shows wanted entries with their priority, and found entries apart', async () => {
    api.listWishItems.mockResolvedValue([
      wish('Dune', { priority: 'HIGH' }),
      wish('Emma', { fulfilled: true, fulfilledAt: '2026-11-10T10:00:00Z' }),
    ]);
    renderAt('/wishlist');

    const wanted = await screen.findByRole('region', { name: /Still looking \(1\)/ });
    expect(within(wanted).getByText('Dune')).toBeInTheDocument();
    expect(within(wanted).getByText('High priority')).toBeInTheDocument();
    expect(within(wanted).getByRole('checkbox', { name: /Got it/ })).not.toBeChecked();

    const found = section(/Found \(1\)/);
    expect(within(found).getByText('Emma')).toBeInTheDocument();
    expect(within(found).getByRole('checkbox', { name: /Got it/ })).toBeChecked();
    expect(within(found).getByText(/Found on/)).toBeInTheDocument();
  });

  it('ticking "Got it" moves the entry to Found, and unticking brings it back', async () => {
    api.listWishItems.mockResolvedValue([wish('Dune')]);
    api.updateWishItem.mockResolvedValueOnce(wish('Dune', { fulfilled: true, fulfilledAt: '2026-11-15T10:00:00Z' }));
    renderAt('/wishlist');

    await userEvent.click(await screen.findByRole('checkbox', { name: /Got it \(Dune\)/ }));
    expect(api.updateWishItem).toHaveBeenCalledWith('Dune', { fulfilled: true });
    expect(await screen.findByRole('region', { name: /Found \(1\)/ })).toBeInTheDocument();
    expect(section(/Still looking \(0\)/)).toHaveTextContent('You have found everything');

    api.updateWishItem.mockResolvedValueOnce(wish('Dune'));
    await userEvent.click(screen.getByRole('checkbox', { name: /Got it \(Dune\)/ }));
    expect(api.updateWishItem).toHaveBeenLastCalledWith('Dune', { fulfilled: false });
    expect(await screen.findByRole('region', { name: /Still looking \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Found/ })).not.toBeInTheDocument();
  });

  it('changing the priority re-sorts the list', async () => {
    api.listWishItems.mockResolvedValue([wish('Dune', { priority: 'HIGH' }), wish('Emma')]);
    api.updateWishItem.mockResolvedValue(wish('Emma', { priority: 'HIGH', createdAt: '2026-11-02T10:00:00Z' }));
    renderAt('/wishlist');

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Priority for Emma' }), 'HIGH');
    expect(api.updateWishItem).toHaveBeenCalledWith('Emma', { priority: 'HIGH' });
    // Same priority now, so the newer entry (Emma) comes first.
    const titles = await screen.findAllByRole('heading', { level: 3 });
    expect(titles.map((title) => title.textContent)).toEqual(['Emma', 'Dune']);
  });

  it('shows the server message when an update fails', async () => {
    api.listWishItems.mockResolvedValue([wish('Dune')]);
    api.updateWishItem.mockRejectedValue(
      Object.assign(new Error('Wish list entry not found.'), { status: 404, code: 'NOT_FOUND' }),
    );
    renderAt('/wishlist');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Got it/ }));
    expect(await screen.findByText('Wish list entry not found.')).toBeInTheDocument();
  });
});

describe('AddWishItem', () => {
  it('sends the chosen priority (Medium by default)', async () => {
    api.addWishItem.mockResolvedValue(wish('Circe'));
    renderAt('/wishlist/new');

    expect(screen.getByRole('radio', { name: /Medium/ })).toBeChecked();
    await userEvent.type(screen.getByLabelText('Title'), 'Circe');
    await userEvent.click(screen.getByRole('radio', { name: /High/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to wish list' }));

    expect(api.addWishItem).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'TITLE', title: 'Circe', priority: 'HIGH' }),
    );
  });
});
