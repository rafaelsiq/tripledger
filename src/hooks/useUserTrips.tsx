import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/src/hooks/useAuth';
import { subscribeUserTrips } from '@/src/services/trips';
import type { Trip } from '@/src/types';

const LAST_TRIP_KEY = 'tripledger:lastTripId';

type UserTripsContextValue = {
  trips: Trip[];
  lastTripId: string | null;
  rememberTripId: (tripId: string) => void;
  loading: boolean;
};

const UserTripsContext = createContext<UserTripsContextValue>({
  trips: [],
  lastTripId: null,
  rememberTripId: () => undefined,
  loading: true,
});

export function UserTripsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [lastTripId, setLastTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LAST_TRIP_KEY)
      .then((value) => {
        if (!cancelled && value) setLastTripId(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeUserTrips(user.uid, (next) => {
      setTrips(next);
      setLoading(false);
    });
  }, [user]);

  const rememberTripId = useCallback((tripId: string) => {
    setLastTripId(tripId);
    AsyncStorage.setItem(LAST_TRIP_KEY, tripId).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ trips, lastTripId, rememberTripId, loading }),
    [trips, lastTripId, rememberTripId, loading]
  );

  return <UserTripsContext.Provider value={value}>{children}</UserTripsContext.Provider>;
}

export function useUserTrips() {
  return useContext(UserTripsContext);
}

/** Extract trip id from paths like /trip/abc or /(app)/trip/abc/finance. */
export function tripIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/trip\/([^/]+)/);
  if (!match) return null;
  const id = match[1];
  if (id === 'new' || id === 'join') return null;
  return id;
}

/** Keep the user in the same trip section when switching trips. */
export function tripSectionFromPath(pathname: string): 'finance' | 'itinerary' | 'feed' | 'members' | null {
  const match = pathname.match(/\/trip\/[^/]+\/(finance|itinerary|feed|members)/);
  return (match?.[1] as 'finance' | 'itinerary' | 'feed' | 'members' | undefined) ?? null;
}
