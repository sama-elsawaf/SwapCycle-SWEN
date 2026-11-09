import type { PublicUser } from './user';

export type BookCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type CopyStatus = 'AVAILABLE' | 'RESERVED' | 'TRANSFERRED' | 'WITHDRAWN';

/** What the book is (shared by many copies). */
export interface BookDescription {
  id: string;
  title: string;
  author: string;
  edition: string | null;
  language: string;
  genre: string;
}

/** One physical copy owned by a reader. */
export interface BookCopy {
  id: string;
  description: BookDescription;
  owner: PublicUser;
  condition: BookCondition;
  conditionNotes: string | null;
  photoUrls: string[];
  status: CopyStatus;
}

export const CONDITION_LABELS: Record<BookCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

export const GENRES = [
  'Fiction', 'Non-Fiction', 'Science', 'Technology',
  'Art & Design', 'Self Help', 'Business', 'Other',
] as const;
