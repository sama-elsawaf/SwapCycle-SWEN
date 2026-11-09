import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import type { CurrentUser, ProfileUpdate } from '../types';
import { isUnauthorized } from '../utils/errors';

// The session itself lives in an httpOnly cookie the browser sends for us;
// nothing about it is stored in JavaScript. This context only remembers who
// the server says is logged in.

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<CurrentUser>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<CurrentUser>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const signedIn = useCallback((next: CurrentUser) => {
    setUser(next);
    setStatus('authenticated');
    return next;
  }, []);

  const signedOut = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    try {
      signedIn(await authApi.getCurrentUser());
    } catch (error) {
      // A 401 just means "not logged in". Other failures also leave the
      // reader logged out locally; protected pages will ask them to log in.
      if (!isUnauthorized(error)) console.warn('Could not load the current session.');
      signedOut();
    }
  }, [signedIn, signedOut]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Any request that finds the session expired logs the reader out here too.
  useEffect(() => {
    setUnauthorizedHandler(signedOut);
    return () => setUnauthorizedHandler(null);
  }, [signedOut]);

  const login = useCallback(
    async (email: string, password: string) => signedIn(await authApi.login({ email, password })),
    [signedIn],
  );

  const register = useCallback(
    async (input: { email: string; password: string; displayName: string }) =>
      signedIn(await authApi.register(input)),
    [signedIn],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      signedOut();
    }
  }, [signedOut]);

  const updateProfile = useCallback(
    async (update: ProfileUpdate) => signedIn(await authApi.updateProfile(update)),
    [signedIn],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, updateProfile, refresh }),
    [status, user, login, register, logout, updateProfile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
