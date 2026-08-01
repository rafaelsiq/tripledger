import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { subscribeAuth } from '@/src/services/auth';
import { getUserProfile } from '@/src/services/auth';
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
    const unsub = subscribeAuth(async (next) => {
      setUser(next);
      if (next) {
        const p = await getUserProfile(next.uid);
        setProfile(
          p || {
            uid: next.uid,
            email: next.email || '',
            displayName: next.displayName || 'Viajante',
            createdAt: Date.now(),
          }
        );
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
