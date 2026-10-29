import React from 'react';
import { useRouter } from 'expo-router';
import { Segmented } from '@/src/components/ui';

export type ItineraryViewId = 'list' | 'calendar' | 'story';

const VIEWS: { id: ItineraryViewId; label: string }[] = [
  { id: 'list', label: 'Lista' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'story', label: 'História' },
];

/** Lista / Calendário / História switcher shared by the three itinerary views. */
export function ItineraryViewSwitcher({
  tripId,
  current,
}: {
  tripId: string;
  current: ItineraryViewId;
}) {
  const router = useRouter();

  function onChange(next: ItineraryViewId) {
    if (next === current) return;
    if (next === 'list') {
      router.navigate(`/(app)/trip/${tripId}/itinerary`);
      return;
    }
    const href =
      next === 'calendar'
        ? `/(app)/trip/${tripId}/itinerary/calendar`
        : `/(app)/trip/${tripId}/itinerary/storytelling`;
    // From the list we stack the view; between calendar and story we swap in place.
    if (current === 'list') router.push(href);
    else router.replace(href);
  }

  return <Segmented options={VIEWS} value={current} onChange={onChange} />;
}
