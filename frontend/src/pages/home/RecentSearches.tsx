import { useState } from 'react';
import { Link } from 'react-router-dom';

import { clearRecentSearches, describeSearch, loadRecentSearches, searchLink } from '../../utils/savedSearches';

/** The reader's last few searches on this device, as one-tap links. Renders nothing when empty. */
export default function RecentSearches({ tone = 'light' }: { tone?: 'light' | 'plain' }) {
  const [searches, setSearches] = useState(loadRecentSearches);

  if (searches.length === 0) return null;

  function clear() {
    clearRecentSearches();
    setSearches([]);
  }

  const chipClass =
    'inline-block max-w-[16rem] truncate rounded-full border border-soft px-4 py-2 text-sm font-medium text-navy ' +
    'hover:border-rose-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep ' +
    (tone === 'light' ? 'bg-white' : 'bg-pink-light');

  return (
    <section aria-labelledby="recent-searches-title" className="mt-5">
      <div className="mb-2 flex items-center gap-3">
        <h2 id="recent-searches-title" className="text-sm font-semibold text-navy">
          Recent searches
        </h2>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-slate underline hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep"
        >
          Clear
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {searches.map((filters) => {
          const label = describeSearch(filters);
          return (
            <li key={searchLink(filters)}>
              <Link to={searchLink(filters)} className={chipClass} title={label}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
