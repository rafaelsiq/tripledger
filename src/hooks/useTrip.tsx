import React, { createContext, useContext } from 'react';
import type { Expense, Payment, Trip, TripMember, TripPhase } from '@/src/types';

export type TripContextValue = {
  tripId: string;
  trip: Trip | null;
  members: TripMember[];
  expenses: Expense[];
  payments: Payment[];
  isAdmin: boolean;
  isFinanceLead: boolean;
  phase: TripPhase;
  isClosed: boolean;
  /** False for regular members when the trip is closed. */
  canMutate: boolean;
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({
  value,
  children,
}: {
  value: TripContextValue;
  children: React.ReactNode;
}) {
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}
