import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import BookCard from '../../components/books/BookCard';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useBookSearch } from '../../hooks/useBooks';
import { useMeetingAreas } from '../../hooks/useMeetingAreas';
import type { BookCondition, Genre, BookSearchParams } from '../../types';
import { CONDITIONS, GENRES, LANGUAGES, LIMITS } from '../../utils/constants';
import { errorMessage } from '../../utils/errors';
import { pluralize } from '../../utils/format';
import { hasFilters, loadSavedFilters, rememberSearch, saveFilters } from '../../utils/savedSearches';
import { filtersFromParams, paramsFromFilters } from '../../utils/searchParams';
import { Alert, EmptyState, LoadingState, PageHeading, Pagination, SelectField } from '../PageParts';
import RecentSearches from './RecentSearches';

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const [draft, setDraft] = useState<BookSearchParams>(filters);
  const { areas } = useMeetingAreas();
  const results = useBookSearch(filters);

  const [usingSaved, setUsingSaved] = useState(false);
  const checkedSaved = useRef(false);

  // Keep the form in step with back/forward navigation.
  useEffect(() => setDraft(filters), [filters]);

  // Opening the page with no filters brings back the reader's last ones.
  // After that, every search updates what is remembered on this device.
  useEffect(() => {
    if (!checkedSaved.current) {
      checkedSaved.current = true;
      const saved = loadSavedFilters();
      if (searchParams.toString() === '' && hasFilters(saved)) {
        setUsingSaved(true);
        setSearchParams(paramsFromFilters(saved), { replace: true });
        return;
      }
    }
    rememberSearch(filters);
    saveFilters(filters);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(next: BookSearchParams) {
    setUsingSaved(false);
    setSearchParams(paramsFromFilters({ ...next, page: undefined }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  const page = filters.page ?? 1;

  return (
    <div>
      <PageHeading title="Find a book" subtitle="Only books that are available to swap right now are shown." />

      <form role="search" onSubmit={handleSubmit} className="rounded-card border border-soft bg-white p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Title or author"
            type="search"
            value={draft.q ?? ''}
            maxLength={LIMITS.searchMax}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
          <Input
            label="Author"
            value={draft.author ?? ''}
            maxLength={LIMITS.searchMax}
            onChange={(event) => setDraft({ ...draft, author: event.target.value })}
          />
          <SelectField
            label="Genre"
            value={draft.genre ?? ''}
            onChange={(event) => setDraft({ ...draft, genre: (event.target.value || undefined) as Genre | undefined })}
          >
            <option value="">Any genre</option>
            {GENRES.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Language"
            value={draft.language ?? ''}
            onChange={(event) => setDraft({ ...draft, language: event.target.value || undefined })}
          >
            <option value="">Any language</option>
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Minimum condition"
            value={draft.minCondition ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, minCondition: (event.target.value || undefined) as BookCondition | undefined })
            }
          >
            <option value="">Any condition</option>
            {CONDITIONS.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label} or better
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Exchange area"
            value={draft.areaId ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, areaId: event.target.value ? Number(event.target.value) : undefined })
            }
          >
            <option value="">Anywhere on campus</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => apply({})}>
            Clear filters
          </Button>
          <Button type="submit" variant="primary">
            Search
          </Button>
        </div>
      </form>

      {usingSaved && (
        <div className="mt-4">
          <Alert tone="info">Showing the filters you used last time. Use “Clear filters” to see every book.</Alert>
        </div>
      )}
      <RecentSearches key={searchParams.toString()} tone="plain" />

      <section aria-live="polite" aria-busy={results.loading} className="mt-8">
        {results.loading && <LoadingState label="Searching…" />}
        {!results.loading && results.error !== undefined && <Alert tone="error">{errorMessage(results.error)}</Alert>}
        {!results.loading && results.data && (
          <>
            <p className="mb-4 text-slate">{pluralize(results.data.total, 'book')} found</p>
            {results.data.items.length === 0 ? (
              <EmptyState title="No books match">
                Try fewer filters, or add the book to your wish list so you hear when it is listed.
              </EmptyState>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {results.data.items.map((listing) => (
                  <li key={listing.id}>
                    <BookCard listing={listing} to={`/books/${listing.id}`} />
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={page}
              pageSize={results.data.pageSize}
              total={results.data.total}
              onChange={(next) => setSearchParams(paramsFromFilters({ ...filters, page: next }))}
            />
          </>
        )}
      </section>
    </div>
  );
}
