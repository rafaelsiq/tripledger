import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { datesBetween, generateInviteCode } from '@/src/lib/finance';
import {
  safeBatchSet,
  safeBatchUpdate,
  safeSetDoc,
  safeUpdateDoc,
} from '@/src/lib/firestore';
import { normalizeInviteCode } from '@/src/lib/invite';
import {
  generateDummyUid,
  isDummyMember,
  remapExpenseUids,
} from '@/src/lib/members';
import { normalizeTripPhase } from '@/src/lib/tripPhase';
import type {
  ConsolidationRequest,
  Expense,
  Payment,
  Settlement,
  Trip,
  TripMember,
  TripPhase,
} from '@/src/types';

function hydrateTrip(data: Trip): Trip {
  return {
    ...data,
    phase: normalizeTripPhase(data.phase),
  };
}

function tripsCol() {
  return collection(db, 'trips');
}

export async function createTrip(input: {
  name: string;
  destination?: string;
  description?: string;
  startDate: string;
  endDate: string;
  admin: { uid: string; displayName: string; email: string };
}) {
  const tripRef = doc(tripsCol());
  const inviteCode = generateInviteCode();
  const now = Date.now();

  const trip = {
    id: tripRef.id,
    name: input.name.trim(),
    destination: input.destination?.trim() || undefined,
    description: input.description?.trim() || undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    phase: 'planning' as const,
    adminUid: input.admin.uid,
    financeLeadUid: input.admin.uid,
    inviteCode,
    // Kept for backward compatibility; budget is derived from planned expenses.
    budgetTotal: 0,
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
  safeBatchSet(batch, tripRef, trip);
  safeBatchSet(batch, doc(db, 'trips', tripRef.id, 'members', input.admin.uid), member);
  safeBatchSet(batch, doc(db, 'inviteCodes', inviteCode), {
    tripId: tripRef.id,
    createdAt: now,
  });
  safeBatchSet(batch, doc(db, 'users', input.admin.uid, 'memberships', tripRef.id), {
    tripId: tripRef.id,
    joinedAt: now,
    role: 'admin',
  });

  const days = datesBetween(input.startDate, input.endDate);
  days.forEach((date, index) => {
    const dayRef = doc(collection(db, 'trips', tripRef.id, 'itineraryDays'));
    safeBatchSet(batch, dayRef, {
      id: dayRef.id,
      tripId: tripRef.id,
      date,
      title: `Dia ${index + 1}`,
      order: index,
    });
  });

  await batch.commit();
  return trip as Trip;
}

export async function joinTripByCode(
  code: string,
  user: { uid: string; displayName: string; email: string }
) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) {
    throw new Error('Código de convite inválido');
  }
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', normalized));
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
    await safeSetDoc(memberRef, member);
    await safeSetDoc(doc(db, 'users', user.uid, 'memberships', tripId), {
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
        trips.push(hydrateTrip(tripSnap.data() as Trip));
      }
    }
    trips.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(trips);
  });
}

export function subscribeTrip(tripId: string, cb: (trip: Trip | null) => void) {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => {
    cb(snap.exists() ? hydrateTrip(snap.data() as Trip) : null);
  });
}

export function subscribeMembers(tripId: string, cb: (members: TripMember[]) => void) {
  return onSnapshot(collection(db, 'trips', tripId, 'members'), (snap) => {
    const members = snap.docs.map((d) => d.data() as TripMember);
    members.sort((a, b) => a.joinedAt - b.joinedAt);
    cb(members);
  });
}

export async function updateTripPhase(
  tripId: string,
  phase: TripPhase,
  actorUid: string
) {
  const tripSnap = await getDoc(doc(db, 'trips', tripId));
  if (!tripSnap.exists()) {
    throw new Error('Viagem não encontrada');
  }
  const trip = hydrateTrip(tripSnap.data() as Trip);
  if (trip.adminUid !== actorUid) {
    throw new Error('Apenas o administrador pode alterar o status da viagem');
  }
  const next = normalizeTripPhase(phase);
  await safeUpdateDoc(doc(db, 'trips', tripId), {
    phase: next,
    updatedAt: Date.now(),
  });
}

export async function transferFinanceLead(tripId: string, uid: string) {
  const memberSnap = await getDoc(doc(db, 'trips', tripId, 'members', uid));
  if (!memberSnap.exists()) {
    throw new Error('Membro não encontrado');
  }
  const member = memberSnap.data() as TripMember;
  if (isDummyMember(member)) {
    throw new Error('Não é possível tornar um placeholder responsável financeiro');
  }
  await safeUpdateDoc(doc(db, 'trips', tripId), {
    financeLeadUid: uid,
    updatedAt: Date.now(),
  });
}

export async function createDummyMember(input: {
  tripId: string;
  displayName: string;
  actorUid: string;
}) {
  const trip = await getTrip(input.tripId);
  if (!trip) throw new Error('Viagem não encontrada');
  if (trip.adminUid !== input.actorUid) {
    throw new Error('Apenas o administrador pode criar placeholders');
  }
  const name = input.displayName.trim();
  if (!name) throw new Error('Informe o nome do placeholder');

  const uid = generateDummyUid();
  const member: TripMember = {
    uid,
    displayName: name,
    email: '',
    role: 'member',
    joinedAt: Date.now(),
    isDummy: true,
    createdByUid: input.actorUid,
  };
  await safeSetDoc(doc(db, 'trips', input.tripId, 'members', uid), member);
  return member;
}

export async function renameDummyMember(input: {
  tripId: string;
  dummyUid: string;
  displayName: string;
  actorUid: string;
}) {
  const trip = await getTrip(input.tripId);
  if (!trip) throw new Error('Viagem não encontrada');
  if (trip.adminUid !== input.actorUid) {
    throw new Error('Apenas o administrador pode editar placeholders');
  }
  const snap = await getDoc(doc(db, 'trips', input.tripId, 'members', input.dummyUid));
  if (!snap.exists()) throw new Error('Placeholder não encontrado');
  const member = snap.data() as TripMember;
  if (!isDummyMember(member)) {
    throw new Error('Só é possível renomear placeholders');
  }
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error('Informe um nome');
  await safeUpdateDoc(doc(db, 'trips', input.tripId, 'members', input.dummyUid), {
    displayName,
  });
}

/**
 * Move all financial (and related) references from a dummy member to a real member,
 * then remove the dummy. Admin only.
 */
export async function linkDummyToRealMember(input: {
  tripId: string;
  dummyUid: string;
  realUid: string;
  actorUid: string;
}) {
  const { tripId, dummyUid, realUid, actorUid } = input;
  if (dummyUid === realUid) {
    throw new Error('Selecione um membro real diferente do placeholder');
  }

  const trip = await getTrip(tripId);
  if (!trip) throw new Error('Viagem não encontrada');
  if (trip.adminUid !== actorUid) {
    throw new Error('Apenas o administrador pode vincular placeholders');
  }

  const dummySnap = await getDoc(doc(db, 'trips', tripId, 'members', dummyUid));
  const realSnap = await getDoc(doc(db, 'trips', tripId, 'members', realUid));
  if (!dummySnap.exists() || !realSnap.exists()) {
    throw new Error('Membro ou placeholder não encontrado');
  }
  const dummy = dummySnap.data() as TripMember;
  const real = realSnap.data() as TripMember;
  if (!isDummyMember(dummy)) {
    throw new Error('O membro de origem precisa ser um placeholder');
  }
  if (isDummyMember(real)) {
    throw new Error('O destino precisa ser um membro real da viagem');
  }

  const [expensesSnap, paymentsSnap, settlementsSnap, consolidationSnap] = await Promise.all([
    getDocs(collection(db, 'trips', tripId, 'expenses')),
    getDocs(collection(db, 'trips', tripId, 'payments')),
    getDocs(collection(db, 'trips', tripId, 'settlements')),
    getDocs(collection(db, 'trips', tripId, 'consolidationRequests')),
  ]);

  let batch = writeBatch(db);
  let ops = 0;
  const commitIfNeeded = async () => {
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  };

  for (const expenseDoc of expensesSnap.docs) {
    const expense = expenseDoc.data() as Expense;
    const touches =
      expense.paidByUid === dummyUid || expense.splits.some((s) => s.uid === dummyUid);
    if (!touches) continue;
    const next = remapExpenseUids(expense, dummyUid, realUid);
    safeBatchSet(batch, expenseDoc.ref, { ...next, updatedAt: Date.now() });
    ops += 1;
    await commitIfNeeded();
  }

  for (const paymentDoc of paymentsSnap.docs) {
    const payment = paymentDoc.data() as Payment;
    const fromUid = payment.fromUid === dummyUid ? realUid : payment.fromUid;
    const toUid = payment.toUid === dummyUid ? realUid : payment.toUid;
    if (fromUid === payment.fromUid && toUid === payment.toUid) continue;
    if (fromUid === toUid) {
      // Self-payment after remap is meaningless; drop it.
      batch.delete(paymentDoc.ref);
    } else {
      safeBatchUpdate(batch, paymentDoc.ref, { fromUid, toUid });
    }
    ops += 1;
    await commitIfNeeded();
  }

  for (const settlementDoc of settlementsSnap.docs) {
    const settlement = settlementDoc.data() as Settlement;
    const fromUid = settlement.fromUid === dummyUid ? realUid : settlement.fromUid;
    const toUid = settlement.toUid === dummyUid ? realUid : settlement.toUid;
    if (fromUid === settlement.fromUid && toUid === settlement.toUid) continue;
    if (fromUid === toUid) {
      batch.delete(settlementDoc.ref);
    } else {
      safeBatchUpdate(batch, settlementDoc.ref, { fromUid, toUid });
    }
    ops += 1;
    await commitIfNeeded();
  }

  for (const reqDoc of consolidationSnap.docs) {
    const req = { id: reqDoc.id, ...reqDoc.data() } as ConsolidationRequest;
    const fromUid = req.fromUid === dummyUid ? realUid : req.fromUid;
    const toUid = req.toUid === dummyUid ? realUid : req.toUid;
    if (fromUid === req.fromUid && toUid === req.toUid) continue;
    safeBatchUpdate(batch, reqDoc.ref, { fromUid, toUid });
    ops += 1;
    await commitIfNeeded();
  }

  // Remap itinerary RSVP attendees / votes that still point at the dummy.
  const daysSnap = await getDocs(collection(db, 'trips', tripId, 'itineraryDays'));
  for (const dayDoc of daysSnap.docs) {
    const itemsSnap = await getDocs(collection(db, 'trips', tripId, 'itineraryDays', dayDoc.id, 'items'));
    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data() as {
        attendees?: string[];
        votes?: Record<string, string>;
      };
      const attendees = data.attendees || [];
      const votes = data.votes || {};
      const hasAttendee = attendees.includes(dummyUid);
      const hasVote = Object.prototype.hasOwnProperty.call(votes, dummyUid);
      if (!hasAttendee && !hasVote) continue;

      const nextAttendees = Array.from(
        new Set(attendees.map((uid) => (uid === dummyUid ? realUid : uid)))
      );
      const nextVotes = { ...votes };
      if (hasVote) {
        const dummyVote = nextVotes[dummyUid];
        delete nextVotes[dummyUid];
        // Prefer the real member's existing vote if both voted.
        if (dummyVote && !nextVotes[realUid]) {
          nextVotes[realUid] = dummyVote;
        }
      }
      safeBatchUpdate(batch, itemDoc.ref, {
        attendees: nextAttendees,
        votes: nextVotes,
      });
      ops += 1;
      await commitIfNeeded();
    }
  }

  batch.delete(doc(db, 'trips', tripId, 'members', dummyUid));
  ops += 1;
  await batch.commit();
}

export async function updateTripBudget(
  tripId: string,
  budgetTotal: number,
  categoryBudgets: Trip['categoryBudgets']
) {
  await safeUpdateDoc(doc(db, 'trips', tripId), {
    budgetTotal,
    categoryBudgets,
    updatedAt: Date.now(),
  });
}

export async function removeMember(tripId: string, uid: string, actorUid?: string) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error('Viagem não encontrada');
  if (uid === trip.adminUid) {
    throw new Error('Não é possível remover o administrador');
  }
  if (actorUid && trip.adminUid !== actorUid) {
    throw new Error('Apenas o administrador pode remover membros');
  }
  const memberSnap = await getDoc(doc(db, 'trips', tripId, 'members', uid));
  const member = memberSnap.exists() ? (memberSnap.data() as TripMember) : null;

  if (member && isDummyMember(member)) {
    const expensesSnap = await getDocs(collection(db, 'trips', tripId, 'expenses'));
    const referenced = expensesSnap.docs.some((d) => {
      const expense = d.data() as Expense;
      return (
        expense.paidByUid === uid || expense.splits.some((s) => s.uid === uid)
      );
    });
    if (referenced) {
      throw new Error(
        'Este placeholder ainda tem lançamentos. Vincule a um membro real antes de remover.'
      );
    }
  }

  await deleteDoc(doc(db, 'trips', tripId, 'members', uid));

  // Real members also lose their membership index; dummies never had one.
  if (member && !isDummyMember(member)) {
    await deleteDoc(doc(db, 'users', uid, 'memberships', tripId)).catch(() => undefined);
  }

  if (trip.financeLeadUid === uid) {
    await safeUpdateDoc(doc(db, 'trips', tripId), {
      financeLeadUid: trip.adminUid,
      updatedAt: Date.now(),
    });
  }
}

export async function getTrip(tripId: string) {
  const snap = await getDoc(doc(db, 'trips', tripId));
  return snap.exists() ? hydrateTrip(snap.data() as Trip) : null;
}

export async function listMembers(tripId: string) {
  const snap = await getDocs(collection(db, 'trips', tripId, 'members'));
  return snap.docs.map((d) => d.data() as TripMember);
}
