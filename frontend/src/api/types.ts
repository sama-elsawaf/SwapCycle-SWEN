// Types for the Sprint 1 API contract (docs/api/openapi.yaml).
// If the spec changes, change this file in the same commit.

/** Wire format: every success is { data }, every failure is { error }. */
export interface ApiSuccess<T> {
  data: T;
}

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL',
] as const;
export type ServerErrorCode = (typeof ERROR_CODES)[number];

/** Codes the client itself can produce when no usable server reply exists. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNKNOWN';
export type ApiErrorCode = ServerErrorCode | ClientErrorCode;

// ---- Enums (as const arrays so the UI can build dropdowns and chips) ----

export const ROLES = ['READER', 'MODERATOR'] as const;
export type Role = (typeof ROLES)[number];

export const INTEREST_CATEGORIES = [
  'FICTION',
  'NON_FICTION',
  'SCIENCE',
  'TECHNOLOGY',
  'ART_DESIGN',
  'SELF_HELP',
  'BUSINESS',
  'OTHER',
] as const;
export type InterestCategory = (typeof INTEREST_CATEGORIES)[number];

export const GENRES = [
  'FICTION',
  'MYSTERY',
  'SCIENCE_FICTION',
  'FANTASY',
  'ROMANCE',
  'THRILLER',
  'BIOGRAPHY',
  'HISTORY',
  'TRAVEL',
  'SCIENCE',
  'TECHNOLOGY',
  'ART_DESIGN',
  'SELF_HELP',
  'BUSINESS',
  'POETRY',
  'OTHER',
] as const;
export type Genre = (typeof GENRES)[number];

/** Ordered best to worst. */
export const BOOK_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'] as const;
export type BookCondition = (typeof BOOK_CONDITIONS)[number];

export const COPY_STATUSES = ['AVAILABLE', 'RESERVED', 'TRANSFERRED', 'WITHDRAWN'] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

/** ISO 639-1, lower case, e.g. "en". */
export type LanguageCode = string;

// ---- Accounts ----

export interface MeetingArea {
  id: number;
  name: string;
}

export interface PrivacySettings {
  showMeetingArea: boolean;
  showInterests: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Your own account. Only ever returned to you. */
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  meetingArea: MeetingArea | null;
  interests: InterestCategory[];
  privacy: PrivacySettings;
  onboardingCompleted: boolean;
}

/** What other readers see. Hidden fields are null. */
export interface PublicProfile {
  id: string;
  displayName: string;
  meetingArea: MeetingArea | null;
  interests: InterestCategory[] | null;
  memberSince: string;
}

/** Every field is optional; only the ones sent are changed. */
export interface ProfileUpdate {
  displayName?: string;
  meetingAreaId?: number | null;
  interests?: InterestCategory[];
  privacy?: PrivacySettings;
  onboardingCompleted?: boolean;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

// ---- Books ----

export interface BookInput {
  title: string;
  author: string;
  edition?: string;
  language: LanguageCode;
  genre: Genre;
  condition: BookCondition;
  conditionNotes?: string;
  exchangeAreaId?: number | null;
}

export interface BookPhoto {
  id: string;
  /** Server path such as /api/photos/<uuid>. Pass it through assetUrl() before use. */
  url: string;
}

/** Only the display name of the owner is public. */
export interface OwnerSummary {
  id: string;
  displayName: string;
}

export interface BookListing {
  /** The BookCopy id. */
  id: string;
  title: string;
  author: string;
  edition: string;
  language: LanguageCode;
  genre: Genre;
  condition: BookCondition;
  conditionNotes: string;
  status: CopyStatus;
  exchangeArea: MeetingArea | null;
  owner: OwnerSummary;
  photos: BookPhoto[];
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export type BookListingPage = Page<BookListing>;

/** Pagination query. page is 1-based, pageSize is at most 50 (server default 20). */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface BookSearchParams extends PageParams {
  /** Matches title or author. */
  q?: string;
  title?: string;
  author?: string;
  genre?: Genre;
  language?: LanguageCode;
  minCondition?: BookCondition;
  areaId?: number;
}

// ---- Wish list ----

export type WishItemKind = 'TITLE' | 'INTEREST';

export const WISH_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type WishPriority = (typeof WISH_PRIORITIES)[number];

/** TITLE needs a title (author optional). INTEREST needs a genre and no title. */
export type WishItemInput =
  | {
      kind: 'TITLE';
      title: string;
      author?: string;
      language?: LanguageCode | null;
      minCondition?: BookCondition | null;
      /** Defaults to MEDIUM on the server. */
      priority?: WishPriority;
    }
  | {
      kind: 'INTEREST';
      genre: Genre;
      language?: LanguageCode | null;
      minCondition?: BookCondition | null;
      priority?: WishPriority;
    };

/** PATCH /wishlist/{id}: send at least one field. */
export interface WishItemUpdate {
  priority?: WishPriority;
  /** true = "Got it" (found); false = still wanted. */
  fulfilled?: boolean;
}

export interface WishItem {
  id: string;
  kind: WishItemKind;
  title: string | null;
  author: string | null;
  genre: Genre | null;
  language: LanguageCode | null;
  minCondition: BookCondition | null;
  priority: WishPriority;
  /** True once the reader marked it "Got it". */
  fulfilled: boolean;
  fulfilledAt: string | null;
  createdAt: string;
}
