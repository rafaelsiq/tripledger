import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays } from 'date-fns';
import { parseDateValue, todayValue } from '@/src/lib/dates';
import type { Trip, TripPhase } from '@/src/types';
import { PHASE_LABELS } from '@/src/types';

export const PHASE_WINDOW_DAYS = 3;
const SNOOZE_PREFIX = 'tripledger:phase-snooze:';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Legacy `active` values from older clients/data. */
export function normalizeTripPhase(phase?: string | null): TripPhase {
  if (phase === 'in_progress' || phase === 'active') return 'in_progress';
  if (phase === 'closed') return 'closed';
  return 'planning';
}

export function phaseLabel(phase?: string | null): string {
  return PHASE_LABELS[normalizeTripPhase(phase)];
}

export function daysUntil(dateValue: string, from = todayValue()): number | null {
  const target = parseDateValue(dateValue);
  const origin = parseDateValue(from);
  if (!target || !origin) return null;
  return differenceInCalendarDays(target, origin);
}

export type PhasePrompt = {
  tripId: string;
  from: TripPhase;
  to: TripPhase;
  title: string;
  message: string;
  actionLabel: string;
};

/** Suggested next phase when within the 3-day window (or past the date). */
export function getPhasePrompt(trip: Trip): PhasePrompt | null {
  const phase = normalizeTripPhase(trip.phase);
  if (phase === 'planning') {
    const days = daysUntil(trip.startDate);
    if (days === null || days > PHASE_WINDOW_DAYS) return null;
    return {
      tripId: trip.id,
      from: 'planning',
      to: 'in_progress',
      title: 'Viagem perto do início',
      message:
        days <= 0
          ? `“${trip.name}” já chegou na data de início. Quer marcar como Em progresso?`
          : `Faltam ${days} dia${days === 1 ? '' : 's'} para o início de “${trip.name}”. Quer marcar como Em progresso?`,
      actionLabel: 'Marcar Em progresso',
    };
  }
  if (phase === 'in_progress') {
    const days = daysUntil(trip.endDate);
    if (days === null || days > PHASE_WINDOW_DAYS) return null;
    return {
      tripId: trip.id,
      from: 'in_progress',
      to: 'closed',
      title: 'Viagem perto do fim',
      message:
        days <= 0
          ? `“${trip.name}” já chegou na data final. Quer concluir a viagem?`
          : `Faltam ${days} dia${days === 1 ? '' : 's'} para o fim de “${trip.name}”. Quer concluir a viagem?`,
      actionLabel: 'Concluir viagem',
    };
  }
  return null;
}

export function canManageClosedTrip(isAdmin: boolean, isFinanceLead: boolean): boolean {
  return isAdmin || isFinanceLead;
}

/** Members cannot mutate a closed trip; admin + finance lead still can (with warning). */
export function canMutateTrip(
  trip: Trip | null | undefined,
  opts: { isAdmin: boolean; isFinanceLead: boolean }
): boolean {
  if (!trip) return false;
  if (normalizeTripPhase(trip.phase) !== 'closed') return true;
  return canManageClosedTrip(opts.isAdmin, opts.isFinanceLead);
}

export function closedTripMemberMessage(): string {
  return 'Esta viagem está concluída. Novos lançamentos e edições ficam bloqueados para membros.';
}

export function closedTripManagerMessage(): string {
  return 'Viagem concluída. Você ainda pode ajustar finanças como administrador ou responsável financeiro.';
}

function snoozeKey(tripId: string, to: TripPhase) {
  return `${SNOOZE_PREFIX}${tripId}:${to}`;
}

export async function snoozePhasePrompt(tripId: string, to: TripPhase): Promise<void> {
  await AsyncStorage.setItem(snoozeKey(tripId, to), String(Date.now() + SNOOZE_MS));
}

export async function isPhasePromptSnoozed(tripId: string, to: TripPhase): Promise<boolean> {
  const raw = await AsyncStorage.getItem(snoozeKey(tripId, to));
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    await AsyncStorage.removeItem(snoozeKey(tripId, to));
    return false;
  }
  return true;
}

export async function clearPhasePromptSnooze(tripId: string, to: TripPhase): Promise<void> {
  await AsyncStorage.removeItem(snoozeKey(tripId, to));
}
