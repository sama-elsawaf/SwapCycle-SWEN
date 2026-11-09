import type { BookCondition, Genre, BookSearchParams } from '../types';
import { CONDITIONS, GENRES, LIMITS } from './constants';
import { isLanguageCode } from './validation';

// Keeps search filters in the URL so results can be shared and survive a
// refresh. Unknown or malformed values are dropped rather than sent on.

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d{1,6}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= 1 ? parsed : undefined;
}

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, LIMITS.searchMax) : undefined;
}

export function filtersFromParams(params: URLSearchParams): BookSearchParams {
  const genre = params.get('genre');
  const minCondition = params.get('minCondition');
  const language = params.get('language');
  return {
    q: text(params.get('q')),
    author: text(params.get('author')),
    genre: GENRES.some((option) => option.value === genre) ? (genre as Genre) : undefined,
    language: language && isLanguageCode(language) ? language : undefined,
    minCondition: CONDITIONS.some((option) => option.value === minCondition)
      ? (minCondition as BookCondition)
      : undefined,
    areaId: positiveInt(params.get('areaId')),
    page: positiveInt(params.get('page')),
  };
}

export function paramsFromFilters(filters: BookSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const entries: Array<[string, string | number | undefined]> = [
    ['q', filters.q],
    ['author', filters.author],
    ['genre', filters.genre],
    ['language', filters.language],
    ['minCondition', filters.minCondition],
    ['areaId', filters.areaId],
    ['page', filters.page && filters.page > 1 ? filters.page : undefined],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params;
}
