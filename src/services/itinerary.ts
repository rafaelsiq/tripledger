import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { omitUndefinedDeep, safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import { uploadTripFile } from '@/src/services/expenses';
import type { ItineraryDay, ItineraryItem, ItineraryVoteValue } from '@/src/types';

export function subscribeItineraryDays(
  tripId: string,
  cb: (days: ItineraryDay[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trips', tripId, 'itineraryDays'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as ItineraryDay));
  });
}

export function subscribeDayItems(
  tripId: string,
  dayId: string,
  cb: (items: ItineraryItem[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'trips', tripId, 'itineraryDays', dayId, 'items'),
    orderBy('order', 'asc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as ItineraryItem));
  });
}

function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function createItineraryItem(input: {
  tripId: string;
  dayId: string;
  title: string;
  description?: string;
  time?: string;
  location?: string;
  mapUrl?: string;
  imageUri?: string;
  order: number;
  createdByUid: string;
}) {
  let imageUrl: string | undefined;
  if (input.imageUri) {
    imageUrl = await uploadTripFile(input.tripId, 'itinerary', input.imageUri);
  }
  const refDoc = doc(collection(db, 'trips', input.tripId, 'itineraryDays', input.dayId, 'items'));
  const item = omitUndefinedDeep({
    id: refDoc.id,
    dayId: input.dayId,
    title: input.title.trim(),
    description: optionalText(input.description),
    imageUrl,
    time: optionalText(input.time),
    location: optionalText(input.location),
    mapUrl: optionalText(input.mapUrl),
    order: input.order,
    done: false,
    attendees: [],
    votes: {},
    createdByUid: input.createdByUid,
    createdAt: Date.now(),
  }) as ItineraryItem;
  await safeSetDoc(refDoc, item);
  return item;
}

export function subscribeDayItem(
  tripId: string,
  dayId: string,
  itemId: string,
  cb: (item: ItineraryItem | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'trips', tripId, 'itineraryDays', dayId, 'items', itemId),
    (snap) => {
      cb(snap.exists() ? (snap.data() as ItineraryItem) : null);
    }
  );
}

export async function toggleItemDone(
  tripId: string,
  dayId: string,
  itemId: string,
  done: boolean
) {
  await safeUpdateDoc(doc(db, 'trips', tripId, 'itineraryDays', dayId, 'items', itemId), { done });
}

export function countVotes(item: ItineraryItem) {
  const votes = item.votes || {};
  const counts = { yes: 0, maybe: 0, no: 0, total: 0 };
  for (const value of Object.values(votes)) {
    if (value === 'yes' || value === 'maybe' || value === 'no') {
      counts[value] += 1;
      counts.total += 1;
    }
  }
  // Legacy attendees without an explicit vote count as "yes".
  for (const uid of item.attendees || []) {
    if (!votes[uid]) {
      counts.yes += 1;
      counts.total += 1;
    }
  }
  return counts;
}

export async function setItemVote(input: {
  tripId: string;
  dayId: string;
  item: ItineraryItem;
  uid: string;
  vote: ItineraryVoteValue;
}) {
  const current = input.item.votes?.[input.uid];
  const votes: Record<string, ItineraryVoteValue> = { ...(input.item.votes || {}) };

  if (current === input.vote) {
    delete votes[input.uid];
  } else {
    votes[input.uid] = input.vote;
  }

  const attendees = Object.entries(votes)
    .filter(([, value]) => value === 'yes')
    .map(([uid]) => uid);

  await safeUpdateDoc(
    doc(db, 'trips', input.tripId, 'itineraryDays', input.dayId, 'items', input.item.id),
    { votes, attendees }
  );
}

/** @deprecated Prefer setItemVote. Toggles a yes-vote for legacy RSVP chips. */
export async function toggleRsvp(
  tripId: string,
  dayId: string,
  item: ItineraryItem,
  uid: string
) {
  await setItemVote({
    tripId,
    dayId,
    item,
    uid,
    vote: 'yes',
  });
}

export async function addTemplateSlots(
  tripId: string,
  dayId: string,
  createdByUid: string,
  startOrder: number
) {
  const templates = [
    { title: 'Manhã', time: '09:00', description: 'Atividade da manhã' },
    { title: 'Tarde', time: '14:00', description: 'Atividade da tarde' },
    { title: 'Noite', time: '20:00', description: 'Atividade da noite' },
  ];
  for (let i = 0; i < templates.length; i += 1) {
    const t = templates[i]!;
    await createItineraryItem({
      tripId,
      dayId,
      title: t.title,
      description: t.description,
      time: t.time,
      order: startOrder + i,
      createdByUid,
    });
  }
}
