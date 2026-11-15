import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useWishlist } from '../../hooks/useWishlist';
import type { WishItem, WishItemUpdate, WishPriority } from '../../types';
import { WISH_PRIORITY_OPTIONS } from '../../utils/constants';
import { errorMessage } from '../../utils/errors';
import { conditionLabel, formatDate, genreLabel, languageName, priorityLabel } from '../../utils/format';
import { paramsFromFilters } from '../../utils/searchParams';
import { Alert, EmptyState, LoadingState, PageHeading, linkClass } from '../PageParts';

function describe(item: WishItem): string {
  const parts = [item.language ? languageName(item.language) : 'Any language'];
  if (item.minCondition) parts.push(`${conditionLabel(item.minCondition)} or better`);
  return parts.join(' · ');
}

function itemName(item: WishItem): string {
  return item.kind === 'TITLE' ? (item.title ?? '') : genreLabel(item.genre);
}

const PRIORITY_TONE: Record<WishPriority, 'danger' | 'warning' | 'neutral'> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

export default function WishList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, error, loading, remove, update } = useWishlist();
  const [busy, setBusy] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const added = (location.state as { added?: boolean } | null)?.added;

  const wanted = items.filter((item) => !item.fulfilled);
  const found = items.filter((item) => item.fulfilled);

  async function run(item: WishItem, action: () => Promise<unknown>) {
    setBusy(item.id);
    setActionError(undefined);
    try {
      await action();
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setBusy(undefined);
    }
  }

  const change = (item: WishItem, changes: WishItemUpdate) => run(item, () => update(item.id, changes));

  function renderItem(item: WishItem) {
    const name = itemName(item);
    const disabled = busy === item.id;
    return (
      <li key={item.id}>
        <Card className={item.fulfilled ? 'bg-pink-light/40' : ''}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  {item.kind === 'TITLE' ? 'Specific book' : 'Interest'}
                </p>
                {!item.fulfilled && (
                  <Badge tone={PRIORITY_TONE[item.priority]}>{priorityLabel(item.priority)} priority</Badge>
                )}
                {item.fulfilled && <Badge tone="success">Got it</Badge>}
              </div>
              <h3
                className={`mt-1 break-words font-display text-xl font-semibold text-navy ${item.fulfilled ? 'line-through decoration-2' : ''}`}
              >
                {name}
              </h3>
              {item.author && <p className="text-navy">by {item.author}</p>}
              <p className="mt-1 text-sm text-slate">{describe(item)}</p>
              {item.fulfilled && item.fulfilledAt && (
                <p className="mt-1 text-sm text-slate">Found on {formatDate(item.fulfilledAt)}</p>
              )}
              {!item.fulfilled && item.kind === 'TITLE' && item.title && (
                <Link to={`/search?${paramsFromFilters({ q: item.title })}`} className={`${linkClass} text-sm`}>
                  Search listings
                </Link>
              )}
            </div>
            <Button
              variant="ghost"
              disabled={disabled}
              aria-label={`Remove ${name} from wish list`}
              onClick={() => run(item, () => remove(item.id))}
            >
              Remove
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-soft pt-4">
            <label className="flex cursor-pointer items-center gap-2 font-medium text-navy">
              <input
                type="checkbox"
                className="h-5 w-5 accent-rose-deep"
                checked={item.fulfilled}
                disabled={disabled}
                onChange={(event) => change(item, { fulfilled: event.target.checked })}
              />
              Got it
              <span className="sr-only"> ({name})</span>
            </label>
            {!item.fulfilled && (
              <label className="flex items-center gap-2 text-sm text-navy">
                Priority
                <select
                  aria-label={`Priority for ${name}`}
                  value={item.priority}
                  disabled={disabled}
                  onChange={(event) => change(item, { priority: event.target.value as WishPriority })}
                  className="h-10 rounded-card border border-soft bg-white px-3 text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-deep"
                >
                  {WISH_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </Card>
      </li>
    );
  }

  return (
    <div>
      <PageHeading
        title="My wish list"
        subtitle="Rank what you want most and tick off books once you have them. Matching uses the ones you are still looking for."
        action={
          <Button variant="primary" onClick={() => navigate('/wishlist/new')}>
            Add to wish list
          </Button>
        }
      />
      <div className="space-y-4">
        {added && <Alert tone="success">Added to your wish list.</Alert>}
        {actionError && <Alert tone="error">{actionError}</Alert>}
        {loading && <LoadingState label="Loading your wish list…" />}
        {!loading && error !== undefined && <Alert tone="error">{errorMessage(error)}</Alert>}
        {!loading && error === undefined && items.length === 0 && (
          <EmptyState title="Your wish list is empty">
            <Link to="/wishlist/new" className={linkClass}>
              Add a book or genre
            </Link>{' '}
            you would like to read.
          </EmptyState>
        )}

        {items.length > 0 && (
          <section aria-labelledby="wanted-title" className="space-y-3">
            <h2 id="wanted-title" className="font-display text-2xl font-semibold text-navy">
              Still looking ({wanted.length})
            </h2>
            {wanted.length === 0 ? (
              <p className="text-slate">You have found everything on your list. Add something new to read next.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">{wanted.map(renderItem)}</ul>
            )}
          </section>
        )}

        {found.length > 0 && (
          <section aria-labelledby="found-title" className="space-y-3 pt-4">
            <h2 id="found-title" className="font-display text-2xl font-semibold text-navy">
              Found ({found.length})
            </h2>
            <p className="text-sm text-slate">Untick “Got it” to put a book back on your list.</p>
            <ul className="grid gap-4 md:grid-cols-2">{found.map(renderItem)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
