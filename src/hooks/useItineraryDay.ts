import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay } from '@/src/types';

/** A day of the trip's itinerary with its "Dia N" labels. */
export function useItineraryDay(tripId: string | undefined, dayId: string | undefined) {
  const [days, setDays] = useState<ItineraryDay[]>([]);

  useEffect(() => {
    if (!tripId) return;
    return subscribeItineraryDays(tripId, setDays);
  }, [tripId]);

  const index = days.findIndex((d) => d.id === dayId);
  const day = index >= 0 ? days[index] : null;
  const short = day ? `Dia ${index + 1}` : 'Dia';
  const dateLabel = day ? format(parseISO(day.date), "EEEE, d MMM", { locale: ptBR }) : '';
  return {
    days,
    day,
    /** "Dia 3" */
    short,
    /** "Dia 3 · quinta-feira, 17 out" */
    eyebrow: dateLabel ? `${short} · ${dateLabel}` : short,
  };
}
