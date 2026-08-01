import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { datesBetween, generateInviteCode } from '@/src/lib/finance';
import type { Trip, TripMember, TripPhase } from '@/src/types';

function tripsCol() {
  return collection(db, 'trips');
}

export async function createTrip(input: {
  name: string;
  destination?: string;
  description?: string;
  startDate: string;
  endDate: string;
  budgetTotal?: number;
  admin: { uid: string; displayName: string; email: string };
}) {
  const tripRef = doc(tripsCol());
  const inviteCode = generateInviteCode();
  const now = Date.now();

  const trip: Trip = {
    id: tripRef.id,
    name: input.name.trim(),
    destination: input.destination?.trim(),
    description: input.description?.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    phase: 'planning',
    adminUid: input.admin.uid,
    financeLeadUid: input.admin.uid,
    inviteCode,
    budgetTotal: input.budgetTotal || 0,
    categoryBudgets: {},
    currency: 'BRL',
    createdAt: now,
    updatedAt: now,
  };

  const member: TripMember = {
    uid: input.admin.uid,
    displayName: input.admin.displayName,
    email: input.admin.email,
    role: 'admin',
    joinedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(tripRef, trip);
  batch.set(doc(db, 'trips', tripRef.id, 'members', input.admin.uid), member);
  batch.set(doc(db, 'inviteCodes', inviteCode), {
    tripId: tripRef.id,
    createdAt: now,
  });
  batch.set(doc(db, 'users', input.admin.uid, 'memberships', tripRef.id), {
    tripId: tripRef.id,
    joinedAt: now,
    role: 'admin',
  });

  const days = datesBetween(input.startDate, input.endDate);
  days.forEach((date, index) => {
    const dayRef = doc(collection(db, 'trips', tripRef.id, 'itineraryDays'));
    batch.set(dayRef, {
      id: dayRef.id,
      tripId: tripRef.id,
      date,
      title: `Dia ${index + 1}`,
      order: index,
    });
  });

  await batch.commit();
  return trip;
}

export async function joinTripByCode(
  code: string,
  user: { uid: string; displayName: string; email: string }
) {
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', code.trim().toUpperCase()));
  if (!inviteSnap.exists()) {
    throw new Error('Código de convite inválido');
  }
  const { tripId } = inviteSnap.data() as { tripId: string };
  const tripSnap = await getDoc(doc(db, 'trips', tripId));
  if (!tripSnap.exists()) {
    throw new Error('Viagem não encontrada');
  }

  const memberRef = doc(db, 'trips', tripId, 'members', user.uid);
  const existing = await getDoc(memberRef);
  if (!existing.exists()) {
    const member: TripMember = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      role: 'member',
      joinedAt: Date.now(),
    };
    await setDoc(memberRef, member);
    await setDoc(doc(db, 'users', user.uid, 'memberships', tripId), {
      tripId,
      joinedAt: Date.now(),
      role: 'member',
    });
  }
  return tripId;
}

export function subscribeUserTrips(uid: string, cb: (trips: Trip[]) => void) {
  return onSnapshot(collection(db, 'users', uid, 'memberships'), async (snap) => {
    const trips: Trip[] = [];
    for (const membership of snap.docs) {
      const tripId = membership.id;
      const tripSnap = await getDoc(doc(db, 'trips', tripId));
      if (tripSnap.exists()) {
        trips.push(tripSnap.data() as Trip);
      }
    }
    trips.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(trips);
  });
}

export function subscribeTrip(tripId: string, cb: (trip: Trip | null) => void) {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => {
    cb(snap.exists() ? (snap.data() as Trip) : null);
  });
}

export function subscribeMembers(tripId: string, cb: (members: TripMember[]) => void) {
  return onSnapshot(collection(db, 'trips', tripId, 'members'), (snap) => {
    const members = snap.docs.map((d) => d.data() as TripMember);
    members.sort((a, b) => a.joinedAt - b.joinedAt);
    cb(members);
  });
}

export async function updateTripPhase(tripId: string, phase: TripPhase) {
  await updateDoc(doc(db, 'trips', tripId), { phase, updatedAt: Date.now() });
}

export async function transferFinanceLead(tripId: string, uid: string) {
  await updateDoc(doc(db, 'trips', tripId), {
    financeLeadUid: uid,
    updatedAt: Date.now(),
  });
}

export async function updateTripBudget(
  tripId: string,
  budgetTotal: number,
  categoryBudgets: Trip['categoryBudgets']
) {
  await updateDoc(doc(db, 'trips', tripId), {
    budgetTotal,
    categoryBudgets,
    updatedAt: Date.now(),
  });
}

export async function removeMember(tripId: string, uid: string) {
  await deleteDoc(doc(db, 'trips', tripId, 'members', uid));
}

export async function getTrip(tripId: string) {
  const snap = await getDoc(doc(db, 'trips', tripId));
  return snap.exists() ? (snap.data() as Trip) : null;
}

export async function listMembers(tripId: string) {
  const snap = await getDocs(collection(db, 'trips', tripId, 'members'));
  return snap.docs.map((d) => d.data() as TripMember);
}
