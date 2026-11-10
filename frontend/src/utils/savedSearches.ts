import type { BookSearchParams } from '../types';
import { conditionLabel, genreLabel, languageName } from './format';
import { filtersFromParams, paramsFromFilters } from './searchParams';
import { readStored, removeStored, STORAGE_KEYS, writeStored } from './storage';

// Recent searches and the last-used search filters, kept on this device.
// Both are stored as query strings and read back through filtersFromParams,
// so anything tampered with is dropped the same way a bad URL would be.

export const MAX_RECENT_SEARCHES = 5;

/** Filters that describe what a reader prefers, as opposed to what they typed. */
type FilterPreferences = Pick<BookSearchParams, 'genre' | 'language' | 'minCondition' | 'areaId'>;

function withoutPage(filters: BookSearchParams): BookSearchParams {
  return { ...filters, page: undefined };
}

function toQuery(filters: BookSearchParams): string {
  return paramsFromFilters(withoutPage(filters)).toString();
}

function fromQuery(value: unknown): BookSearchParams | undefined {
  if (typeof value !== 'string' || value.length > 1000) return undefined;
  const filters = withoutPage(filtersFromParams(new URLSearchParams(value)));
  return toQuery(filters) ? filters : undefined;
}

export function hasFilters(filters: BookSearchParams): boolean {
  return toQuery(filters) !== '';
}

// ---- Recent searches ----

export function loadRecentSearches(): BookSearchParams[] {
  const stored = readStored(STORAGE_KEYS.recentSearches);
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const searches: BookSearchParams[] = [];
  for (const entry of stored) {
    const filters = fromQuery(entry);
    if (!filters) continue;
    const query = toQuery(filters);
    if (seen.has(query)) continue;
    seen.add(query);
    searches.push(filters);
    if (searches.length === MAX_RECENT_SEARCHES) break;
  }
  return searches;
}

/** Remembers a search the reader typed. Filter-only browsing is not recorded. */
export function rememberSearch(filters: BookSearchParams): void {
  if (!filters.q && !filters.author) return;
  const query = toQuery(filters);
  const rest = loadRecentSearches()
    .map(toQuery)
    .filter((existing) => existing !== query);
  writeStored(STORAGE_KEYS.recentSearches, [query, ...rest].slice(0, MAX_RECENT_SEARCHES));
}

export function clearRecentSearches(): void {
  removeStored(STORAGE_KEYS.recentSearches);
}

/** A short label such as "dune · Science fiction · Good or better". */
export function describeSearch(filters: BookSearchParams): string {
  const parts: string[] = [];
  if (filters.q) parts.push(filters.q);
  if (filters.author) parts.push(`by ${filters.author}`);
  if (filters.genre) parts.push(genreLabel(filters.genre));
  if (filters.language) parts.push(languageName(filters.language));
  if (filters.minCondition) parts.push(`${conditionLabel(filters.minCondition)} or better`);
  if (filters.areaId) parts.push('One area');
  return parts.join(' · ');
}

export function searchLink(filters: BookSearchParams): string {
  return `/search?${toQuery(filters)}`;
}

// ---- Last-used filters ----

function preferencesOf(filters: BookSearchParams): FilterPreferences {
  return {
    genre: filters.genre,
    language: filters.language,
    minCondition: filters.minCondition,
    areaId: filters.areaId,
  };
}

export function loadSavedFilters(): FilterPreferences {
  return preferencesOf(fromQuery(readStored(STORAGE_KEYS.searchFilters)) ?? {});
}

/** Saves the reader's filter choices, or forgets them when none are set. */
export function saveFilters(filters: BookSearchParams): void {
  const query = toQuery(preferencesOf(filters));
  if (query) writeStored(STORAGE_KEYS.searchFilters, query);
  else removeStored(STORAGE_KEYS.searchFilters);
}
