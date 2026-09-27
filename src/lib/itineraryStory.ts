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
