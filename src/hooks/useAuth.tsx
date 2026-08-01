import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { subscribeAuth, getUserProfile } from '@/src/services/auth';
import type { AppUser } from '@/src/types';

type AuthContextValue = {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;

    const finish = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    // Never block the UI forever if Auth/Firestore hangs.
    const timeout = setTimeout(finish, 4000);

    const unsub = subscribeAuth(async (next) => {
      try {
        setUser(next);
        if (next) {
          try {
            const p = await getUserProfile(next.uid);
            setProfile(
              p || {
                uid: next.uid,
                email: next.email || '',
                displayName: next.displayName || 'Viajante',
                createdAt: Date.now(),
              }
            );
          } catch {
            setProfile({
              uid: next.uid,
              email: next.email || '',
              displayName: next.displayName || 'Viajante',
              createdAt: Date.now(),
            });
          }
        } else {
          setProfile(null);
        }
      } finally {
        clearTimeout(timeout);
        finish();
      }
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
