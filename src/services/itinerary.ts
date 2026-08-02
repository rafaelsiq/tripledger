import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { omitUndefinedDeep, safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import { closedTripMemberMessage, canMutateTrip } from '@/src/lib/tripPhase';
import { uploadTripFile } from '@/src/services/expenses';
import { getTrip } from '@/src/services/trips';
import type { ItineraryDay, ItineraryItem, ItineraryVoteValue } from '@/src/types';

/** Author can manage their own item; admin can manage any. */
export function canManageItineraryItem(
  item: Pick<ItineraryItem, 'createdByUid'>,
  actor: { uid: string; isAdmin: boolean }
) {
  return actor.isAdmin || item.createdByUid === actor.uid;
}

async function assertCanManageItineraryItem(input: {
  tripId: string;
  item: ItineraryItem;
  actorUid: string;
}) {
  const trip = await getTrip(input.tripId);
  if (!trip) throw new Error('Viagem não encontrada.');
  const isAdmin = trip.adminUid === input.actorUid;
  const isFinanceLead = trip.financeLeadUid === input.actorUid;
  if (!canMutateTrip(trip, { isAdmin, isFinanceLead })) {
    throw new Error(closedTripMemberMessage());
  }
  if (!canManageItineraryItem(input.item, { uid: input.actorUid, isAdmin })) {
    throw new Error('Apenas o autor ou o administrador podem alterar esta atividade.');
  }
  return trip;
}

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

export async function updateItineraryItem(input: {
  tripId: string;
  dayId: string;
  item: ItineraryItem;
  actorUid: string;
  title: string;
  description?: string;
  time?: string;
  location?: string;
  mapUrl?: string;
  imageUri?: string;
  clearImage?: boolean;
}) {
  await assertCanManageItineraryItem({
    tripId: input.tripId,
    item: input.item,
    actorUid: input.actorUid,
  });

  let imageUrl: string | null | undefined = input.item.imageUrl;
  if (input.clearImage) {
    imageUrl = null;
  } else if (input.imageUri) {
    imageUrl = await uploadTripFile(input.tripId, 'itinerary', input.imageUri);
  }

  // Use null for cleared optionals so merge updates remove old values.
  await safeSetDoc(
    doc(db, 'trips', input.tripId, 'itineraryDays', input.dayId, 'items', input.item.id),
    {
      id: input.item.id,
      dayId: input.dayId,
      title: input.title.trim(),
      description: optionalText(input.description) ?? null,
      time: optionalText(input.time) ?? null,
      location: optionalText(input.location) ?? null,
      mapUrl: optionalText(input.mapUrl) ?? null,
      imageUrl: imageUrl ?? null,
      order: input.item.order,
      done: input.item.done,
      attendees: input.item.attendees || [],
      votes: input.item.votes || {},
      createdByUid: input.item.createdByUid,
      createdAt: input.item.createdAt,
    },
    { merge: true }
  );
}

export async function deleteItineraryItem(input: {
  tripId: string;
  dayId: string;
  item: ItineraryItem;
  actorUid: string;
}) {
  await assertCanManageItineraryItem({
    tripId: input.tripId,
    item: input.item,
    actorUid: input.actorUid,
  });
  await deleteDoc(
    doc(db, 'trips', input.tripId, 'itineraryDays', input.dayId, 'items', input.item.id)
  );
}
