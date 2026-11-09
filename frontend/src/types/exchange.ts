import type { BookListing, OwnerSummary } from '../api/types';

// Draft types for exchanges. openapi.yaml has no exchange endpoints yet; when
// the exchange module adds them, move these into api/types.ts to match the spec.

export type ExchangeStatus =
  | 'PROPOSED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

export type ParticipantResponse = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** One reader's side of an exchange: gives one copy, receives another. */
export interface ExchangeParticipant {
  user: OwnerSummary;
  gives: BookListing;
  receives: BookListing;
  response: ParticipantResponse;
  transferred: boolean;
}

export interface Exchange {
  id: string;
  status: ExchangeStatus;
  /** Plain-language reason this match was suggested. */
  explanation: string;
  participants: ExchangeParticipant[];
  expiresAt: string | null;
  createdAt: string;
}

export const STATUS_LABELS: Record<ExchangeStatus, string> = {
  PROPOSED: 'Waiting for responses',
  ACTIVE: 'Everyone accepted',
  COMPLETED: 'Completed',
  PARTIALLY_COMPLETED: 'Partly completed',
  REJECTED: 'Declined',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  DISPUTED: 'In dispute',
};
