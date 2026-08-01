import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { uploadTripFile } from '@/src/services/expenses';
import type { ItineraryDay, ItineraryItem } from '@/src/types';

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
  const item: ItineraryItem = {
    id: refDoc.id,
    dayId: input.dayId,
    title: input.title.trim(),
    description: input.description,
    imageUrl,
    time: input.time,
    location: input.location,
    mapUrl: input.mapUrl,
    order: input.order,
    done: false,
    attendees: [],
    createdByUid: input.createdByUid,
    createdAt: Date.now(),
  };
  await setDoc(refDoc, item);
  return item;
}

export async function toggleItemDone(
  tripId: string,
  dayId: string,
  itemId: string,
  done: boolean
) {
  await updateDoc(doc(db, 'trips', tripId, 'itineraryDays', dayId, 'items', itemId), { done });
}

export async function toggleRsvp(
  tripId: string,
  dayId: string,
  item: ItineraryItem,
  uid: string
) {
  const attendees = item.attendees.includes(uid)
    ? item.attendees.filter((id) => id !== uid)
    : [...item.attendees, uid];
  await updateDoc(doc(db, 'trips', tripId, 'itineraryDays', dayId, 'items', item.id), {
    attendees,
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
