import type { BookCondition, CopyStatus, Genre, InterestCategory, WishItem, WishPriority } from '../types';
import { CONDITIONS, GENRES, INTEREST_CATEGORIES, LANGUAGES, WISH_PRIORITY_OPTIONS } from './constants';

export function genreLabel(genre: Genre | null | undefined): string {
  return GENRES.find((option) => option.value === genre)?.label ?? 'Other';
}

export function conditionLabel(condition: BookCondition | null | undefined): string {
  return CONDITIONS.find((option) => option.value === condition)?.label ?? 'Unknown';
}

export function interestLabel(category: InterestCategory): string {
  return INTEREST_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}

export function languageName(code: string | null | undefined): string {
  if (!code) return 'Any language';
  return LANGUAGES.find((language) => language.code === code)?.label ?? code.toUpperCase();
}

const STATUS_LABELS: Record<CopyStatus, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved for an exchange',
  TRANSFERRED: 'Exchanged',
  WITHDRAWN: 'Withdrawn',
};

export function statusLabel(status: CopyStatus): string {
  return STATUS_LABELS[status];
}

export function statusTone(status: CopyStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'RESERVED') return 'warning';
  return 'neutral';
}

/** "5 March 2026" in the reader's locale; empty string for invalid input. */
export function formatDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "The Hound of the Baskervilles by Arthur Conan Doyle (2nd)". */
export function bookTitleLine(book: { title: string; author: string; edition?: string | null }): string {
  const edition = book.edition ? ` (${book.edition})` : '';
  return `${book.title} by ${book.author}${edition}`;
}

export function priorityLabel(priority: WishPriority): string {
  return WISH_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? 'Medium';
}

const PRIORITY_RANK: Record<WishPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * The server's wish list order, for keeping the list sorted after a local change:
 * still wanted first (HIGH, MEDIUM, LOW, then newest), then found (most recently found first).
 */
export function sortWishItems(items: readonly WishItem[]): WishItem[] {
  return [...items].sort((a, b) => {
    if (a.fulfilled !== b.fulfilled) return a.fulfilled ? 1 : -1;
    if (a.fulfilled && b.fulfilled) return (b.fulfilledAt ?? '').localeCompare(a.fulfilledAt ?? '');
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return byPriority !== 0 ? byPriority : b.createdAt.localeCompare(a.createdAt);
  });
}
