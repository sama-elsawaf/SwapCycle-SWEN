// Small wrapper around localStorage for conveniences that should survive a
// page reload or a closed tab: recent searches, last search filters and
// unsent form drafts.
//
// Rules:
// - Never store the session, tokens, passwords, emails or anything the server
//   treats as secret. The session stays in its httpOnly cookie.
// - Treat everything read back as untrusted. Callers check the shape and
//   values before using them.
// - Storage can be missing or full (private windows, blocked site data), so
//   every call fails quietly and the app works without it.

const PREFIX = 'swapcycle:v1:';

export const STORAGE_KEYS = {
  recentSearches: 'recent-searches',
  searchFilters: 'search-filters',
  bookDraft: 'draft:book',
  wishDraft: 'draft:wish',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The parsed value, or undefined if it is missing, unreadable or not JSON. */
export function readStored(key: StorageKey): unknown {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

export function writeStored(key: StorageKey, value: unknown): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Full or blocked storage only loses a convenience.
  }
}

export function removeStored(key: StorageKey): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

/** Removes everything SwapCycle stored on this device. Called on logout. */
export function clearStoredData(): void {
  const store = storage();
  if (!store) return;
  try {
    const ours: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(PREFIX)) ours.push(key);
    }
    ours.forEach((key) => store.removeItem(key));
  } catch {
    // Nothing to do.
  }
}
