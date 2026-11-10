import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../api/auth';
import * as booksApi from '../api/books';
import * as wishlistApi from '../api/wishlist';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { resetMeetingAreasCache } from '../hooks/useMeetingAreas';
import { saveFilters } from '../utils/savedSearches';
import { makeUser } from '../utils/testHelpers';
import Home from './home/Home';
import SearchResults from './home/SearchResults';
import AddBook from './listings/AddBook';
import AddWishItem from './wishlist/AddWishItem';

vi.mock('../api/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  listMeetingAreas: vi.fn(),
}));
vi.mock('../api/books', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/books')>()),
  createBook: vi.fn(),
  uploadBookPhoto: vi.fn(),
  searchBooks: vi.fn(),
}));
vi.mock('../api/wishlist', () => ({
  listWishItems: vi.fn(),
  addWishItem: vi.fn(),
  removeWishItem: vi.fn(),
}));

const auth = vi.mocked(authApi);
const books = vi.mocked(booksApi);
const wishlist = vi.mocked(wishlistApi);

/** Shows the page once the session is known, like the app's RequireAuth. */
function WhenLoggedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  return status === 'authenticated' ? <>{children}</> : <p>loading</p>;
}

function CurrentUrl() {
  const location = useLocation();
  return <output aria-label="current url">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <WhenLoggedIn>
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/books/new" element={<AddBook />} />
            <Route path="/books/:copyId/edit" element={<p>edit page</p>} />
            <Route path="/wishlist/new" element={<AddWishItem />} />
            <Route path="/wishlist" element={<p>wish list page</p>} />
          </Routes>
          <CurrentUrl />
        </WhenLoggedIn>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetMeetingAreasCache();
  auth.getCurrentUser.mockResolvedValue(makeUser());
  auth.listMeetingAreas.mockResolvedValue([{ id: 1, name: 'Main Library' }]);
  books.searchBooks.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
});

describe('List a book draft', () => {
  it('keeps typed details across visits and can be discarded', async () => {
    const first = renderAt('/books/new');
    await userEvent.type(await screen.findByLabelText('Title'), 'Dune');
    await userEvent.type(screen.getByLabelText('Author'), 'Frank Herbert');
    first.unmount();

    renderAt('/books/new');
    expect(await screen.findByText(/kept the details you started/)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Dune');
    expect(screen.getByLabelText('Author')).toHaveValue('Frank Herbert');

    await userEvent.click(screen.getByRole('button', { name: 'Start again' }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.queryByText(/kept the details/)).not.toBeInTheDocument();
    expect(localStorage.getItem('swapcycle:v1:draft:book')).toBeNull();
  });

  it('does not offer another account’s draft', async () => {
    const first = renderAt('/books/new');
    await userEvent.type(await screen.findByLabelText('Title'), 'Dune');
    first.unmount();

    auth.getCurrentUser.mockResolvedValue(makeUser({ id: '00000000-0000-4000-8000-000000000002' }));
    renderAt('/books/new');
    expect(await screen.findByLabelText('Title')).toHaveValue('');
    expect(screen.queryByText(/kept the details/)).not.toBeInTheDocument();
  });
});

describe('Wish item draft', () => {
  it('restores the draft and clears it once the item is added', async () => {
    const first = renderAt('/wishlist/new');
    await userEvent.type(await screen.findByLabelText('Title'), 'Emma');
    first.unmount();

    renderAt('/wishlist/new');
    expect(await screen.findByText(/kept what you started/)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Emma');

    wishlist.addWishItem.mockResolvedValue({} as never);
    await userEvent.click(screen.getByRole('button', { name: 'Add to wish list' }));
    expect(await screen.findByText('wish list page')).toBeInTheDocument();
    expect(localStorage.getItem('swapcycle:v1:draft:wish')).toBeNull();
  });
});

describe('Search memory', () => {
  it('brings back the last filters when the search page opens without any', async () => {
    saveFilters({ genre: 'MYSTERY', minCondition: 'GOOD' });
    renderAt('/search');
    expect(await screen.findByText(/filters you used last time/)).toBeInTheDocument();
    // React Router applies URL changes as a transition, so they can land a moment after the note.
    await waitFor(() =>
      expect(screen.getByLabelText('current url')).toHaveTextContent('/search?genre=MYSTERY&minCondition=GOOD'),
    );
    await waitFor(() =>
      expect(books.searchBooks).toHaveBeenLastCalledWith(expect.objectContaining({ genre: 'MYSTERY' })),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(screen.getByLabelText('current url')).toHaveTextContent(/^\/search$/);
      expect(localStorage.getItem('swapcycle:v1:search-filters')).toBeNull();
    });
  });

  it('leaves links that already carry filters alone', async () => {
    saveFilters({ genre: 'MYSTERY' });
    renderAt('/search?genre=TRAVEL');
    await screen.findByText('0 books found');
    expect(screen.getByLabelText('current url')).toHaveTextContent('/search?genre=TRAVEL');
    expect(screen.queryByText(/filters you used last time/)).not.toBeInTheDocument();
  });

  it('lists recent searches on the home page and forgets them on request', async () => {
    const first = renderAt('/search');
    await userEvent.type(await screen.findByLabelText('Title or author'), 'dune{Enter}');
    await waitFor(() => expect(screen.getByLabelText('current url')).toHaveTextContent('/search?q=dune'));
    first.unmount();

    renderAt('/home');
    const link = await screen.findByRole('link', { name: 'dune' });
    expect(link).toHaveAttribute('href', '/search?q=dune');

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('link', { name: 'dune' })).not.toBeInTheDocument();
    expect(localStorage.getItem('swapcycle:v1:recent-searches')).toBeNull();
  });
});
