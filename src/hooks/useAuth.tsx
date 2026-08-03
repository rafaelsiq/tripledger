import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  getResolvedUserProfile,
  getUserProfile,
  isGenericDisplayName,
  resolveDisplayName,
  subscribeAuth,
  syncMembershipDisplayNames,
} from '@/src/services/auth';
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
    let cancelled = false;

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
            // Registration writes the profile right after createUser; retry so we
            // don't lock onto the old "Viajante" fallback from a race.
            let p = await getUserProfile(next.uid);
            if (!p || isGenericDisplayName(p.displayName)) {
              for (let i = 0; i < 8 && !cancelled; i++) {
                await new Promise((r) => setTimeout(r, 150));
                p = await getUserProfile(next.uid);
                if (p && !isGenericDisplayName(p.displayName)) break;
              }
            }

            const displayName = resolveDisplayName({
              displayName: p?.displayName ?? next.displayName,
              email: p?.email || next.email,
            });
            const nextProfile: AppUser = p
              ? { ...p, displayName }
              : {
                  uid: next.uid,
                  email: next.email || '',
                  displayName,
                  createdAt: Date.now(),
                };

            if (!cancelled) setProfile(nextProfile);

            if (!isGenericDisplayName(displayName)) {
              void syncMembershipDisplayNames(next.uid, displayName);
            }
          } catch {
            if (!cancelled) {
              const fallback = await getResolvedUserProfile(next).catch(() => null);
              setProfile(
                fallback
                  ? {
                      uid: fallback.uid,
                      email: fallback.email,
                      displayName: fallback.displayName,
                      createdAt: Date.now(),
                    }
                  : {
                      uid: next.uid,
                      email: next.email || '',
                      displayName: resolveDisplayName({
                        displayName: next.displayName,
                        email: next.email,
                      }),
                      createdAt: Date.now(),
                    }
              );
            }
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
      cancelled = true;
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
