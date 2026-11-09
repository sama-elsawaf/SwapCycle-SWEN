export type UserRole = 'reader' | 'moderator';

export interface PrivacySettings {
  showMeetingArea: boolean;
}

/** Public view of a reader: display name and general area only. */
export interface PublicUser {
  id: string;
  displayName: string;
  meetingArea: string | null;
}

/** The signed-in user's own profile. Never includes password or hash. */
export interface User extends PublicUser {
  email: string;
  role: UserRole;
  interests: string[];
  privacy: PrivacySettings;
}
