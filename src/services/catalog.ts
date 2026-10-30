import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { destinationKey, slugify } from '@/src/lib/destinations';
import { formatMinutesAsTime } from '@/src/lib/itineraryStory';
import { omitUndefinedDeep, safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import type {
  ActivityBestPeriod,
  ActivityCatalogEntry,
  ActivityCatalogStatus,
  ActivityCategory,
  ActivityCostHint,
  ItineraryItem,
} from '@/src/types';

const COLLECTION = 'activityCatalog';

export const BEST_PERIOD_LABELS: Record<ActivityBestPeriod, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
  any: 'Qualquer hora',
};

export const COST_HINT_LABELS: Record<ActivityCostHint, string> = {
  free: 'Grátis',
  $: '$',
  $$: '$$',
  $$$: '$$$',
};

/** Curadoria = you or the update routine; Comunidade = sent by users. */
export function catalogSourceLabel(entry: Pick<ActivityCatalogEntry, 'source'>) {
  return entry.source === 'user' ? 'Comunidade' : 'Curadoria';
}

export function formatDuration(minutes?: number): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `~${String(hours).replace('.', ',')}h`;
}

const PERIOD_START: Partial<Record<ActivityBestPeriod, number>> = {
  morning: 9 * 60,
  afternoon: 14 * 60,
  night: 20 * 60,
};

/** Start/end suggested by the rolê's best period and typical duration. */
export function suggestedTimes(
  entry: Pick<ActivityCatalogEntry, 'bestPeriod' | 'durationMin'>
): { time?: string; endTime?: string } {
  const start = entry.bestPeriod ? PERIOD_START[entry.bestPeriod] : undefined;
  if (start === undefined) return {};
  const end = entry.durationMin ? Math.min(start + entry.durationMin, 23 * 60 + 59) : undefined;
  return {
    time: formatMinutesAsTime(start),
    endTime: end !== undefined ? formatMinutesAsTime(end) : undefined,
  };
}

function byUsage(a: ActivityCatalogEntry, b: ActivityCatalogEntry) {
  return (b.usageCount ?? 0) - (a.usageCount ?? 0) || a.title.localeCompare(b.title, 'pt-BR');
}

/**
 * Published rolês for a destination, most used first. Equality filters only, so no
 * composite index is needed; ordering happens here.
 */
export function subscribePublishedCatalog(
  key: string,
  cb: (entries: ActivityCatalogEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('destinationKey', '==', key),
    where('status', '==', 'published')
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as ActivityCatalogEntry).sort(byUsage)),
    () => cb([])
  );
}

export function subscribeCatalogEntry(
  id: string,
  cb: (entry: ActivityCatalogEntry | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTION, id),
    (snap) => cb(snap.exists() ? (snap.data() as ActivityCatalogEntry) : null),
    () => cb(null)
  );
}

/** Every rolê with a given review status, newest first (curation queue). */
export function subscribeCatalogByStatus(
  status: ActivityCatalogStatus,
  cb: (entries: ActivityCatalogEntry[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTION), where('status', '==', status)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => d.data() as ActivityCatalogEntry)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      ),
    () => cb([])
  );
}

/** Curators are listed by uid in `config/catalog` (edited in the Firebase console). */
export function subscribeIsCatalogCurator(uid: string, cb: (isCurator: boolean) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'config', 'catalog'),
    (snap) => {
      const uids = (snap.exists() ? (snap.data().curatorUids as unknown) : null) ?? [];
      cb(Array.isArray(uids) && uids.includes(uid));
    },
    () => cb(false)
  );
}

export async function setCatalogStatus(id: string, status: ActivityCatalogStatus) {
  await safeUpdateDoc(doc(db, COLLECTION, id), { status, updatedAt: Date.now() });
}

/** Counts one more trip using the rolê; ordering only, so failures are ignored. */
export async function recordCatalogUsage(id: string) {
  try {
    await safeUpdateDoc(doc(db, COLLECTION, id), { usageCount: increment(1) });
  } catch {
    // Popularity is best effort.
  }
}

/** Sends an itinerary item to the catalog as a pending community suggestion. */
export async function submitCatalogSuggestion(input: {
  destination: string;
  item: Pick<ItineraryItem, 'title' | 'description' | 'kind' | 'location' | 'mapUrl' | 'imageUrl'>;
  uid: string;
  category?: ActivityCategory;
}) {
  const key = destinationKey(input.destination);
  if (!key) throw new Error('Defina o destino da viagem para sugerir rolês.');
  const ref = doc(collection(db, COLLECTION));
  const id = `${key}__${slugify(input.item.title).slice(0, 40) || 'role'}-${ref.id.slice(0, 6).toLowerCase()}`;
  const now = Date.now();
  const entry = omitUndefinedDeep({
    id,
    destinationKey: key,
    destinationName: input.destination.trim(),
    title: input.item.title.trim(),
    description: input.item.description?.trim() || undefined,
    category: input.category ?? (input.item.kind === 'rest' ? 'descanso' : 'passeio'),
    kind: input.item.kind === 'rest' ? 'rest' : 'activity',
    location: input.item.location?.trim() || undefined,
    mapUrl: input.item.mapUrl?.trim() || undefined,
    imageUrl: input.item.imageUrl,
    source: 'user',
    status: 'pending',
    createdByUid: input.uid,
    usageCount: 1,
    createdAt: now,
    updatedAt: now,
  }) as ActivityCatalogEntry;
  await safeSetDoc(doc(db, COLLECTION, id), entry);
  return entry;
}
