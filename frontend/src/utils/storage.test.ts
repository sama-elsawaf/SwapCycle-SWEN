import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bookDraftHasContent,
  clearDraft,
  DRAFT_MAX_AGE_MS,
  loadDraft,
  sanitizeBookDraft,
  sanitizeWishDraft,
  saveDraft,
} from './drafts';
import {
  clearRecentSearches,
  describeSearch,
  hasFilters,
  loadRecentSearches,
  loadSavedFilters,
  MAX_RECENT_SEARCHES,
  rememberSearch,
  saveFilters,
  searchLink,
} from './savedSearches';
import { clearStoredData, readStored, removeStored, STORAGE_KEYS, writeStored } from './storage';

const OWNER = '00000000-0000-4000-8000-000000000001';
const raw = (key: string) => localStorage.getItem(`swapcycle:v1:${key}`);

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('reads back what it writes, under a SwapCycle prefix', () => {
    writeStored(STORAGE_KEYS.searchFilters, { a: 1 });
    expect(raw('search-filters')).toBe('{"a":1}');
    expect(readStored(STORAGE_KEYS.searchFilters)).toEqual({ a: 1 });
    removeStored(STORAGE_KEYS.searchFilters);
    expect(readStored(STORAGE_KEYS.searchFilters)).toBeUndefined();
  });

  it('ignores values that are not JSON', () => {
    localStorage.setItem('swapcycle:v1:search-filters', '{not json');
    expect(readStored(STORAGE_KEYS.searchFilters)).toBeUndefined();
  });

  it('clears only its own keys', () => {
    localStorage.setItem('other-app', 'keep');
    writeStored(STORAGE_KEYS.recentSearches, ['q=dune']);
    writeStored(STORAGE_KEYS.bookDraft, { owner: OWNER });
    clearStoredData();
    expect(localStorage.getItem('other-app')).toBe('keep');
    expect(localStorage.length).toBe(1);
  });

  it('fails quietly when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      key: () => null,
      length: 0,
    });
    expect(() => writeStored(STORAGE_KEYS.searchFilters, 'x')).not.toThrow();
    expect(readStored(STORAGE_KEYS.searchFilters)).toBeUndefined();
    expect(() => removeStored(STORAGE_KEYS.searchFilters)).not.toThrow();
    expect(() => clearStoredData()).not.toThrow();
    expect(loadRecentSearches()).toEqual([]);
  });
});

describe('recent searches', () => {
  it('keeps typed searches, newest first, without duplicates or page numbers', () => {
    rememberSearch({ q: 'dune', page: 3 });
    rememberSearch({ author: 'Austen' });
    rememberSearch({ q: 'dune' });
    expect(loadRecentSearches()).toEqual([
      expect.objectContaining({ q: 'dune', page: undefined }),
      expect.objectContaining({ author: 'Austen' }),
    ]);
  });

  it('does not record filter-only browsing', () => {
    rememberSearch({ genre: 'MYSTERY' });
    rememberSearch({});
    expect(loadRecentSearches()).toEqual([]);
  });

  it(`keeps at most ${MAX_RECENT_SEARCHES}`, () => {
    for (let index = 1; index <= MAX_RECENT_SEARCHES + 2; index += 1) rememberSearch({ q: `book ${index}` });
    const searches = loadRecentSearches();
    expect(searches).toHaveLength(MAX_RECENT_SEARCHES);
    expect(searches[0].q).toBe(`book ${MAX_RECENT_SEARCHES + 2}`);
  });

  it('drops tampered entries', () => {
    writeStored(STORAGE_KEYS.recentSearches, [42, 'genre=NOT_A_GENRE', 'q=ok&minCondition=BAD', 'x'.repeat(2000)]);
    expect(loadRecentSearches()).toEqual([expect.objectContaining({ q: 'ok', minCondition: undefined })]);
    writeStored(STORAGE_KEYS.recentSearches, { q: 'not a list' });
    expect(loadRecentSearches()).toEqual([]);
  });

  it('describes and links a search', () => {
    const filters = { q: 'dune', genre: 'SCIENCE_FICTION' as const, minCondition: 'GOOD' as const };
    expect(describeSearch(filters)).toMatch(/^dune · .+ · .+ or better$/);
    expect(searchLink(filters)).toBe('/search?q=dune&genre=SCIENCE_FICTION&minCondition=GOOD');
  });

  it('can be cleared', () => {
    rememberSearch({ q: 'dune' });
    clearRecentSearches();
    expect(loadRecentSearches()).toEqual([]);
  });
});

describe('saved filters', () => {
  it('remembers filter choices but not the typed text', () => {
    saveFilters({ q: 'dune', author: 'Herbert', genre: 'MYSTERY', language: 'en', areaId: 2, page: 4 });
    expect(loadSavedFilters()).toEqual({ genre: 'MYSTERY', language: 'en', minCondition: undefined, areaId: 2 });
  });

  it('forgets them when no filters are set', () => {
    saveFilters({ genre: 'MYSTERY' });
    saveFilters({ q: 'only text' });
    expect(raw('search-filters')).toBeNull();
    expect(hasFilters(loadSavedFilters())).toBe(false);
  });
});

describe('drafts', () => {
  const now = 1_000_000_000_000;

  it('only returns a draft to the account that wrote it', () => {
    saveDraft(STORAGE_KEYS.bookDraft, OWNER, { title: 'Dune' }, now);
    expect(loadDraft(STORAGE_KEYS.bookDraft, OWNER, sanitizeBookDraft, now)).toMatchObject({ title: 'Dune' });
    expect(loadDraft(STORAGE_KEYS.bookDraft, 'someone-else', sanitizeBookDraft, now)).toBeUndefined();
    // The mismatched draft is removed rather than left behind.
    expect(raw('draft:book')).toBeNull();
  });

  it('expires after a week', () => {
    saveDraft(STORAGE_KEYS.bookDraft, OWNER, { title: 'Dune' }, now);
    expect(loadDraft(STORAGE_KEYS.bookDraft, OWNER, sanitizeBookDraft, now + DRAFT_MAX_AGE_MS + 1)).toBeUndefined();
  });

  it('cleans a stored book draft', () => {
    const draft = sanitizeBookDraft({
      title: 'x'.repeat(500),
      author: 7,
      language: 'english',
      genre: 'NOT_A_GENRE',
      condition: 'GOOD',
      exchangeAreaId: -1,
      photos: ['secret.jpg'],
    });
    expect(draft).toEqual({ title: 'x'.repeat(200), author: '', edition: '', conditionNotes: '', condition: 'GOOD' });
    expect(sanitizeBookDraft({ title: '   ' })).toBeUndefined();
    expect(sanitizeBookDraft('nope')).toBeUndefined();
    expect(bookDraftHasContent({ conditionNotes: 'spine creased' })).toBe(true);
  });

  it('cleans a stored wish draft', () => {
    expect(sanitizeWishDraft({ kind: 'INTEREST', genre: 'MYSTERY', language: 'EN!' })).toEqual({
      kind: 'INTEREST',
      title: '',
      author: '',
      genre: 'MYSTERY',
      language: '',
      minCondition: '',
    });
    expect(sanitizeWishDraft({ kind: 'TITLE' })).toBeUndefined();
  });

  it('can be cleared', () => {
    saveDraft(STORAGE_KEYS.wishDraft, OWNER, { title: 'Dune' }, now);
    clearDraft(STORAGE_KEYS.wishDraft);
    expect(raw('draft:wish')).toBeNull();
  });
});
