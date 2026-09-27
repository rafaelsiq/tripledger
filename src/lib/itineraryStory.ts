import type { ItineraryItem } from '@/src/types';

/** Parse free-text activity time (`HH:mm` / `H:mm`) into minutes from midnight. */
export function parseItemTime(time?: string | null): number | null {
  if (!time) return null;
  const match = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Format minutes from midnight as `HH:mm`. */
export function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Timed items ascending by clock, then untimed by order. */
export function sortItemsByTime(items: ItineraryItem[]): ItineraryItem[] {
  return items.slice().sort((a, b) => {
    const ta = parseItemTime(a.time);
    const tb = parseItemTime(b.time);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;
    return a.order - b.order;
  });
}

/**
 * Pick highlight activities for storytelling overview.
 * Prefer items with images, then lower order.
 */
export function pickMainActivities(items: ItineraryItem[], limit = 3): ItineraryItem[] {
  return items
    .slice()
    .sort((a, b) => {
      const ai = a.imageUrl ? 0 : 1;
      const bi = b.imageUrl ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.order - b.order;
    })
    .slice(0, Math.max(0, limit));
}

export function splitTimedAndUntimed(items: ItineraryItem[]): {
  timed: ItineraryItem[];
  untimed: ItineraryItem[];
} {
  const sorted = sortItemsByTime(items);
  const timed: ItineraryItem[] = [];
  const untimed: ItineraryItem[] = [];
  for (const item of sorted) {
    if (parseItemTime(item.time) !== null) timed.push(item);
    else untimed.push(item);
  }
  return { timed, untimed };
}

export type StoryHourSlot = {
  hour: number;
  label: string;
  items: ItineraryItem[];
};

/** Fixed 00:00–23:00 hour slots for the storytelling day timeline. */
export function buildHourSlots(items: ItineraryItem[]): {
  hours: StoryHourSlot[];
  untimed: ItineraryItem[];
} {
  const buckets: ItineraryItem[][] = Array.from({ length: 24 }, () => []);
  const untimed: ItineraryItem[] = [];

  for (const item of items) {
    const minutes = parseItemTime(item.time);
    if (minutes === null) {
      untimed.push(item);
      continue;
    }
    buckets[Math.floor(minutes / 60)]!.push(item);
  }

  for (const bucket of buckets) {
    bucket.sort((a, b) => {
      const ta = parseItemTime(a.time) ?? 0;
      const tb = parseItemTime(b.time) ?? 0;
      if (ta !== tb) return ta - tb;
      return a.order - b.order;
    });
  }

  untimed.sort((a, b) => a.order - b.order);

  const hours: StoryHourSlot[] = buckets.map((hourItems, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    items: hourItems,
  }));

  return { hours, untimed };
}
