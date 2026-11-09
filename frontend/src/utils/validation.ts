import type { BookInput, WishItemKind } from '../types';
import { CONDITIONS, GENRES, LIMITS } from './constants';

// Client-side checks mirror the server rules so readers get instant feedback.
// The server validates everything again; never rely on these alone.

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Character count that treats emoji and accented letters as one character. */
function length(value: string): number {
  return Array.from(value.trim()).length;
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (value.length > LIMITS.emailMax || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a valid email address.';
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (password.length < LIMITS.passwordMin) return `Password must be at least ${LIMITS.passwordMin} characters.`;
  if (password.length > LIMITS.passwordMax) return `Password must be at most ${LIMITS.passwordMax} characters.`;
  return undefined;
}

export function validateDisplayName(name: string): string | undefined {
  const count = length(name);
  if (count < LIMITS.displayNameMin || count > LIMITS.displayNameMax) {
    return `Display name must be ${LIMITS.displayNameMin} to ${LIMITS.displayNameMax} characters.`;
  }
  return undefined;
}

export function isLanguageCode(value: string): boolean {
  return /^[a-z]{2}$/.test(value);
}

export function validateBookInput(input: BookInput): FieldErrors<BookInput> {
  const errors: FieldErrors<BookInput> = {};
  if (length(input.title) < 1) errors.title = 'Enter the title.';
  else if (length(input.title) > LIMITS.titleMax) errors.title = `Title must be at most ${LIMITS.titleMax} characters.`;
  if (length(input.author) < 1) errors.author = 'Enter the author.';
  else if (length(input.author) > LIMITS.authorMax) {
    errors.author = `Author must be at most ${LIMITS.authorMax} characters.`;
  }
  if (length(input.edition ?? '') > LIMITS.editionMax) {
    errors.edition = `Edition must be at most ${LIMITS.editionMax} characters.`;
  }
  if (length(input.conditionNotes ?? '') > LIMITS.conditionNotesMax) {
    errors.conditionNotes = `Condition notes must be at most ${LIMITS.conditionNotesMax} characters.`;
  }
  if (!isLanguageCode(input.language)) errors.language = 'Choose a language.';
  if (!GENRES.some((genre) => genre.value === input.genre)) errors.genre = 'Choose a genre.';
  if (!CONDITIONS.some((condition) => condition.value === input.condition)) errors.condition = 'Choose a condition.';
  return errors;
}

/** A wish list entry as typed into the form, before it becomes a WishItemInput. */
export interface WishItemDraft {
  kind: WishItemKind;
  title?: string;
  author?: string;
  genre?: string;
  language?: string | null;
}

export type WishItemErrors = Partial<Record<'title' | 'author' | 'genre' | 'language', string>>;

export function validateWishItem(input: WishItemDraft): WishItemErrors {
  const errors: WishItemErrors = {};
  if (input.kind === 'TITLE') {
    const title = input.title ?? '';
    if (length(title) < 1) errors.title = 'Enter the title you are looking for.';
    else if (length(title) > LIMITS.titleMax) errors.title = `Title must be at most ${LIMITS.titleMax} characters.`;
    if (input.author && length(input.author) > LIMITS.authorMax) {
      errors.author = `Author must be at most ${LIMITS.authorMax} characters.`;
    }
  } else if (!input.genre || !GENRES.some((genre) => genre.value === input.genre)) {
    errors.genre = 'Choose a genre.';
  }
  if (input.language && !isLanguageCode(input.language)) errors.language = 'Choose a language.';
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

/** Checks a chosen photo before upload; the server re-checks the real file signature. */
export function validatePhotoFile(file: File): string | undefined {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') return 'Photos must be JPEG or PNG images.';
  if (file.size > LIMITS.photoBytesMax) return 'Photos must be 5 MB or smaller.';
  return undefined;
}
