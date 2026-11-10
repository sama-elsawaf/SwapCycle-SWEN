import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BookCard from '../../components/books/BookCard';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useBookSearch } from '../../hooks/useBooks';
import { GENRES } from '../../utils/constants';
import { errorMessage } from '../../utils/errors';
import { paramsFromFilters } from '../../utils/searchParams';
import { Alert, EmptyState, LoadingState, linkClass } from '../PageParts';
import RecentSearches from './RecentSearches';

const FEATURED_GENRES = GENRES.filter((genre) =>
  ['FICTION', 'MYSTERY', 'SCIENCE_FICTION', 'BIOGRAPHY', 'TRAVEL', 'SELF_HELP'].includes(genre.value),
);

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const recent = useBookSearch({ page: 1, pageSize: 8 });

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/search?${paramsFromFilters({ q: query })}`);
  }

  return (
    <div className="space-y-10">
      <section className="rounded-card bg-pink-light px-6 py-8 sm:px-10">
        <h1 className="font-display text-4xl font-bold text-navy sm:text-5xl">
          {user ? `Hello, ${user.displayName}` : 'Find your next read'}
        </h1>
        <p className="mt-2 max-w-xl text-lg text-navy">Same books. Brighter stories. Swap with readers on campus.</p>
        <form role="search" onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              label="Search by title or author"
              hideLabel
              type="search"
              placeholder="Search by title or author"
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Browse by genre">
          {FEATURED_GENRES.map((genre) => (
            <li key={genre.value}>
              <Link
                to={`/search?${paramsFromFilters({ genre: genre.value })}`}
                className="inline-block rounded-full border border-soft bg-white px-4 py-2 text-sm font-medium text-navy hover:border-rose-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep"
              >
                {genre.label}
              </Link>
            </li>
          ))}
        </ul>
        <RecentSearches />
      </section>

      {user && (
        <section aria-label="Your shortcuts" className="grid gap-4 sm:grid-cols-3">
          <Shortcut to="/books/new" title="List a book" text="Offer a book you have finished." />
          <Shortcut to="/my-books" title="My books" text="Edit, withdraw or add photos." />
          <Shortcut to="/wishlist" title="My wish list" text="Tell us what you want to read." />
        </section>
      )}

      <section aria-labelledby="recent-title">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="recent-title" className="font-display text-2xl font-semibold text-navy">
            Recently listed
          </h2>
          <Link to="/search" className={linkClass}>
            See all
          </Link>
        </div>
        {recent.loading && <LoadingState label="Loading books…" />}
        {recent.error !== undefined && <Alert tone="error">{errorMessage(recent.error)}</Alert>}
        {recent.data && recent.data.items.length === 0 && (
          <EmptyState title="No books listed yet">Be the first to list a book you are ready to swap.</EmptyState>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.data.items.map((listing) => (
              <li key={listing.id}>
                <BookCard listing={listing} to={`/books/${listing.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Shortcut({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="block rounded-card border border-soft bg-white p-5 hover:border-rose-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
    >
      <span className="block font-display text-xl font-semibold text-navy">{title}</span>
      <span className="mt-1 block text-sm text-slate">{text}</span>
    </Link>
  );
}
