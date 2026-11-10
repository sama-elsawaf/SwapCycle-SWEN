import type { BookCondition, Genre, InterestCategory } from '../types';

// Option lists shared by forms and filters. Values match the API enums in
// docs/api/openapi.yaml; labels are what readers see.

export const INTEREST_CATEGORIES: ReadonlyArray<{ value: InterestCategory; label: string }> = [
  { value: 'FICTION', label: 'Fiction' },
  { value: 'NON_FICTION', label: 'Non-Fiction' },
  { value: 'SCIENCE', label: 'Science' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'ART_DESIGN', label: 'Art & Design' },
  { value: 'SELF_HELP', label: 'Self Help' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'OTHER', label: 'Other' },
];

export const GENRES: ReadonlyArray<{ value: Genre; label: string }> = [
  { value: 'FICTION', label: 'Fiction' },
  { value: 'MYSTERY', label: 'Mystery' },
  { value: 'SCIENCE_FICTION', label: 'Science Fiction' },
  { value: 'FANTASY', label: 'Fantasy' },
  { value: 'ROMANCE', label: 'Romance' },
  { value: 'THRILLER', label: 'Thriller' },
  { value: 'BIOGRAPHY', label: 'Biography' },
  { value: 'HISTORY', label: 'History' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'SCIENCE', label: 'Science' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'ART_DESIGN', label: 'Art & Design' },
  { value: 'SELF_HELP', label: 'Self Help' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'POETRY', label: 'Poetry' },
  { value: 'OTHER', label: 'Other' },
];

// Best to worst, as the API orders them.
export const CONDITIONS: ReadonlyArray<{ value: BookCondition; label: string; hint: string }> = [
  { value: 'NEW', label: 'New', hint: 'Unread, no marks' },
  { value: 'LIKE_NEW', label: 'Like new', hint: 'Read once, no visible wear' },
  { value: 'GOOD', label: 'Good', hint: 'Light wear, all pages intact' },
  { value: 'FAIR', label: 'Fair', hint: 'Noticeable wear or notes' },
  { value: 'POOR', label: 'Poor', hint: 'Heavy wear but readable' },
];

// Common languages on campus; any ISO 639-1 code is accepted by the API.
export const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fa', label: 'Persian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'es', label: 'Spanish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ur', label: 'Urdu' },
];

export const LIMITS = {
  passwordMin: 8,
  passwordMax: 128,
  displayNameMin: 2,
  displayNameMax: 40,
  emailMax: 254,
  titleMax: 200,
  authorMax: 120,
  editionMax: 60,
  conditionNotesMax: 500,
  searchMax: 100,
  pageSize: 20,
} as const;
