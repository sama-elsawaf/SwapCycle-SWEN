import type { BookCondition, Genre, WishItemKind } from '../types';
import { CONDITIONS, GENRES, LIMITS } from './constants';
import { readStored, removeStored, writeStored, type StorageKey } from './storage';
import { isLanguageCode } from './validation';

// Unsent form drafts kept on this device so a reader who leaves a form, or
// whose tab closes, can pick up where they stopped.
//
// Each draft records which account wrote it and is only offered back to that
// account, so a second person on a shared computer never sees it. Drafts
// expire after a week. Photos are never stored: browsers cannot keep a picked
// file, and they would be too large anyway.

export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredDraft {
  owner: string;
  savedAt: number;
  values: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function oneOf<T extends string>(value: unknown, options: ReadonlyArray<{ value: T }>): T | undefined {
  return options.find((option) => option.value === value)?.value;
}

export function loadDraft<T>(
  key: StorageKey,
  owner: string,
  sanitize: (values: unknown) => T | undefined,
  now = Date.now(),
): T | undefined {
  const stored = readStored(key);
  if (!isRecord(stored)) return undefined;
  const { owner: storedOwner, savedAt } = stored as Partial<StoredDraft>;
  if (storedOwner !== owner || typeof savedAt !== 'number' || now - savedAt > DRAFT_MAX_AGE_MS || savedAt > now) {
    removeStored(key);
    return undefined;
  }
  return sanitize(stored.values);
}

export function saveDraft(key: StorageKey, owner: string, values: unknown, now = Date.now()): void {
  const draft: StoredDraft = { owner, savedAt: now, values };
  writeStored(key, draft);
}

export function clearDraft(key: StorageKey): void {
  removeStored(key);
}

// ---- List a book ----

export interface BookDraft {
  title: string;
  author: string;
  edition: string;
  language: string;
  genre: Genre;
  condition: BookCondition;
  conditionNotes: string;
  exchangeAreaId: number | null;
}

/** True when the reader has typed something worth keeping. */
export function bookDraftHasContent(draft: Partial<BookDraft>): boolean {
  return [draft.title, draft.author, draft.edition, draft.conditionNotes].some((value) => !!value?.trim());
}

export function sanitizeBookDraft(values: unknown): Partial<BookDraft> | undefined {
  if (!isRecord(values)) return undefined;
  const draft: Partial<BookDraft> = {
    title: text(values.title, LIMITS.titleMax),
    author: text(values.author, LIMITS.authorMax),
    edition: text(values.edition, LIMITS.editionMax),
    conditionNotes: text(values.conditionNotes, LIMITS.conditionNotesMax),
  };
  if (typeof values.language === 'string' && isLanguageCode(values.language)) draft.language = values.language;
  const genre = oneOf(values.genre, GENRES);
  if (genre) draft.genre = genre;
  const condition = oneOf(values.condition, CONDITIONS);
  if (condition) draft.condition = condition;
  const area = values.exchangeAreaId;
  if (area === null || (typeof area === 'number' && Number.isInteger(area) && area > 0)) draft.exchangeAreaId = area;
  return bookDraftHasContent(draft) ? draft : undefined;
}

// ---- Add a wish item ----

export interface WishDraft {
  kind: WishItemKind;
  title: string;
  author: string;
  genre: Genre | '';
  language: string;
  minCondition: BookCondition | '';
}

export function wishDraftHasContent(draft: WishDraft): boolean {
  return !!(draft.title.trim() || draft.author.trim() || draft.genre || draft.language || draft.minCondition);
}

export function sanitizeWishDraft(values: unknown): WishDraft | undefined {
  if (!isRecord(values)) return undefined;
  const draft: WishDraft = {
    kind: values.kind === 'INTEREST' ? 'INTEREST' : 'TITLE',
    title: text(values.title, LIMITS.titleMax),
    author: text(values.author, LIMITS.authorMax),
    genre: oneOf(values.genre, GENRES) ?? '',
    language: typeof values.language === 'string' && isLanguageCode(values.language) ? values.language : '',
    minCondition: oneOf(values.minCondition, CONDITIONS) ?? '',
  };
  return wishDraftHasContent(draft) ? draft : undefined;
}
