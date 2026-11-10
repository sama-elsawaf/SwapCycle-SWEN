import { describe, expect, it } from 'vitest';

import { BOOK_CONDITIONS, GENRES as API_GENRES, INTEREST_CATEGORIES as API_INTERESTS } from '../api/types';
import type { BookInput } from '../types';
import { CONDITIONS, GENRES, INTEREST_CATEGORIES } from './constants';
import { errorMessage, isUnauthorized } from './errors';
import { bookTitleLine, conditionLabel, formatDate, genreLabel, languageName, pluralize } from './format';
import { homeFor, safeRedirectPath } from './navigation';
import { filtersFromParams, paramsFromFilters } from './searchParams';
import { apiError } from './testHelpers';
import {
  hasErrors,
  validateBookInput,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateWishItem,
} from './validation';

const validBook: BookInput = {
  title: 'Dune',
  author: 'Frank Herbert',
  edition: '',
  language: 'en',
  genre: 'SCIENCE_FICTION',
  condition: 'GOOD',
  conditionNotes: '',
  exchangeAreaId: null,
};

describe('validation', () => {
  it('checks email, password and display name like the server', () => {
    expect(validateEmail('sara@example.com')).toBeUndefined();
    expect(validateEmail('  ')).toBeDefined();
    expect(validateEmail('sara@example')).toBeDefined();
    expect(validateEmail('sara@example.com\u0000x')).toBeDefined();
    expect(validatePassword('1234567')).toMatch(/at least 8/);
    expect(validatePassword('12345678')).toBeUndefined();
    expect(validatePassword('x'.repeat(129))).toMatch(/at most 128/);
    expect(validateDisplayName(' S ')).toBeDefined();
    expect(validateDisplayName('Noor')).toBeUndefined();
  });

  it('counts characters, not bytes', () => {
    expect(validateDisplayName('📚📚')).toBeUndefined();
    expect(validateDisplayName('é'.repeat(40))).toBeUndefined();
    expect(validateDisplayName('é'.repeat(41))).toBeDefined();
  });

  it('validates book listings', () => {
    expect(hasErrors(validateBookInput(validBook))).toBe(false);
    const errors = validateBookInput({ ...validBook, title: '  ', language: 'English', author: 'x'.repeat(121) });
    expect(errors.title).toBeDefined();
    expect(errors.language).toBeDefined();
    expect(errors.author).toBeDefined();
  });

  it('validates wish list entries by kind', () => {
    expect(hasErrors(validateWishItem({ kind: 'TITLE', title: 'Dune' }))).toBe(false);
    expect(validateWishItem({ kind: 'TITLE', title: ' ' }).title).toBeDefined();
    expect(validateWishItem({ kind: 'INTEREST' }).genre).toBeDefined();
    expect(hasErrors(validateWishItem({ kind: 'INTEREST', genre: 'TRAVEL', language: 'ar' }))).toBe(false);
  });
});

describe('safeRedirectPath', () => {
  it('keeps same-site paths', () => {
    expect(safeRedirectPath('/books/123?tab=photos')).toBe('/books/123?tab=photos');
  });

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a\nb', 42, null])(
    'rejects %s',
    (candidate) => {
      expect(safeRedirectPath(candidate)).toBe('/home');
    },
  );

  it('sends new readers to onboarding', () => {
    expect(homeFor({ onboardingCompleted: false })).toBe('/onboarding');
    expect(homeFor({ onboardingCompleted: true })).toBe('/home');
  });
});

describe('search params', () => {
  it('round-trips valid filters', () => {
    const filters = { q: 'dune', genre: 'SCIENCE_FICTION' as const, minCondition: 'GOOD' as const, areaId: 2, page: 3 };
    expect(filtersFromParams(paramsFromFilters(filters))).toEqual({ ...filters, author: undefined, language: undefined });
  });

  it('drops unknown or malformed values', () => {
    const filters = filtersFromParams(
      new URLSearchParams('genre=COOKING&minCondition=MINT&language=English&areaId=-1&page=abc&q=%20%20'),
    );
    expect(filters).toEqual({
      q: undefined,
      author: undefined,
      genre: undefined,
      language: undefined,
      minCondition: undefined,
      areaId: undefined,
      page: undefined,
    });
  });

  it('caps search text at 100 characters and omits page 1', () => {
    expect(filtersFromParams(new URLSearchParams({ q: 'a'.repeat(150) })).q).toHaveLength(100);
    expect(paramsFromFilters({ q: 'x', page: 1 }).toString()).toBe('q=x');
  });
});

describe('errors', () => {
  it('shows reader-facing server messages for 4xx', () => {
    expect(errorMessage(apiError(401, 'UNAUTHORIZED', 'Invalid email or password'))).toBe('Invalid email or password');
    expect(isUnauthorized(apiError(401, 'UNAUTHORIZED', 'x'))).toBe(true);
  });

  it('hides 5xx details and unknown errors', () => {
    expect(errorMessage(apiError(500, 'INTERNAL', 'stack trace here'), 'Oops')).toBe('Oops');
    expect(errorMessage(new Error('random'), 'Oops')).toBe('Oops');
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/couldn't reach/);
    expect(errorMessage(apiError(429, 'RATE_LIMITED', 'x'))).toMatch(/Too many attempts/);
  });
});

describe('format', () => {
  it('labels enums for readers', () => {
    expect(genreLabel('SCIENCE_FICTION')).toBe('Science Fiction');
    expect(conditionLabel('LIKE_NEW')).toBe('Like new');
    expect(languageName('ar')).toBe('Arabic');
    expect(languageName('xx')).toBe('XX');
    expect(pluralize(1, 'book')).toBe('1 book');
    expect(pluralize(2, 'book')).toBe('2 books');
    expect(bookTitleLine({ title: 'Dune', author: 'Frank Herbert', edition: '2nd' })).toBe('Dune by Frank Herbert (2nd)');
  });

  it('formats dates and ignores invalid ones', () => {
    expect(formatDate('2026-03-05T10:00:00Z', 'en-GB')).toBe('5 March 2026');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('option lists', () => {
  // The labelled lists in constants.ts must offer exactly the values the API accepts,
  // in the API's order (conditions run best to worst).
  it('match the API enums', () => {
    expect(GENRES.map((option) => option.value)).toEqual([...API_GENRES]);
    expect(INTEREST_CATEGORIES.map((option) => option.value)).toEqual([...API_INTERESTS]);
    expect(CONDITIONS.map((option) => option.value)).toEqual([...BOOK_CONDITIONS]);
  });
});
