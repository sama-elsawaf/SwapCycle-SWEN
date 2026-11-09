import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { assetUrl } from '../../api/client';
import type { BookListing } from '../../types';
import { languageName, statusLabel } from '../../utils/format';
import Card from '../ui/Card';
import ConditionBadge from './ConditionBadge';

interface Props {
  listing: BookListing;
  /** Makes the whole card a link. */
  to?: string;
  /** Makes the whole card a button (ignored when `to` is set). */
  onSelect?: (listing: BookListing) => void;
  /** Extra content under the details, e.g. a status badge. */
  footer?: ReactNode;
}

export default function BookCard({ listing, to, onSelect, footer }: Props) {
  const cover = listing.photos[0] ? assetUrl(listing.photos[0].url) : '';
  const body = (
    <Card className="flex h-full gap-4">
      {cover ? (
        <img
          src={cover}
          alt={`Photo of ${listing.title}`}
          loading="lazy"
          className="h-28 w-20 shrink-0 rounded-lg bg-white object-cover"
        />
      ) : (
        <div className="h-28 w-20 shrink-0 rounded-lg border border-soft bg-pink-light" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        {/* React escapes all text; no raw HTML is rendered. */}
        <h3 className="truncate text-lg">{listing.title}</h3>
        <p className="truncate text-sm text-slate">
          {listing.author} · {languageName(listing.language)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConditionBadge condition={listing.condition} />
          {listing.status !== 'AVAILABLE' && (
            <span className="rounded-full border border-warning bg-white px-3 py-1 text-xs font-medium text-navy">
              {statusLabel(listing.status)}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-xs text-slate">
          {listing.owner.displayName}
          {listing.exchangeArea ? ` · ${listing.exchangeArea.name}` : ''}
        </p>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </Card>
  );

  const interactive =
    'block h-full rounded-card hover:[&>div]:border-rose-deep focus-visible:outline focus-visible:outline-2 ' +
    'focus-visible:outline-offset-2 focus-visible:outline-rose-deep';
  if (to) {
    return (
      <Link to={to} className={interactive}>
        {body}
      </Link>
    );
  }
  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(listing)} className={`${interactive} w-full text-left`}>
        {body}
      </button>
    );
  }
  return body;
}
