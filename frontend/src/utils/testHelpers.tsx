import type { CurrentUser } from '../types';

// Shared fixtures for tests.

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'sara@example.com',
    displayName: 'Sara',
    role: 'READER',
    meetingArea: null,
    interests: [],
    privacy: { showMeetingArea: true, showInterests: true },
    onboardingCompleted: true,
    ...overrides,
  };
}

/** Mimics the API client's error shape: { status, code, message }. */
export function apiError(status: number, code: string, message: string): Error & { status: number; code: string } {
  return Object.assign(new Error(message), { status, code });
}
