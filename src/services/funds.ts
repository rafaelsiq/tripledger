import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { omitUndefinedDeep, safeBatchSet, safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import { round2 } from '@/src/lib/finance';
import { closedTripMemberMessage, canMutateTrip } from '@/src/lib/tripPhase';
import { getTrip } from '@/src/services/trips';
import type { Fund, FundMovement, FundMovementType } from '@/src/types';

/** Admin, finance lead or the fund holder can confirm/refund/edit a fund. */
export function canManageFund(
  fund: Pick<Fund, 'holderUid'>,
  actor: { uid: string; isAdmin: boolean; isFinanceLead: boolean }
) {
  return actor.isAdmin || actor.isFinanceLead || fund.holderUid === actor.uid;
}

async function loadActor(tripId: string, actorUid: string) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error('Viagem não encontrada.');
  const isAdmin = trip.adminUid === actorUid;
  const isFinanceLead = trip.financeLeadUid === actorUid;
  if (!canMutateTrip(trip, { isAdmin, isFinanceLead })) {
    throw new Error(closedTripMemberMessage());
  }
  return { uid: actorUid, isAdmin, isFinanceLead };
}

export function subscribeFunds(tripId: string, cb: (funds: Fund[]) => void): Unsubscribe {
  const q = query(collection(db, 'trips', tripId, 'funds'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as Fund)));
}

export function subscribeFundMovements(
  tripId: string,
  cb: (movements: FundMovement[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trips', tripId, 'fundMovements'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as FundMovement)));
}

export async function createFund(input: {
  tripId: string;
  name: string;
  holderUid: string;
  actorUid: string;
}) {
  const actor = await loadActor(input.tripId, input.actorUid);
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome ao caixa.');
  if (input.holderUid !== actor.uid && !actor.isAdmin && !actor.isFinanceLead) {
    throw new Error('Só o admin ou o responsável financeiro podem criar um caixa para outra pessoa.');
  }
  const refDoc = doc(collection(db, 'trips', input.tripId, 'funds'));
  const now = Date.now();
  const fund: Fund = {
    id: refDoc.id,
    tripId: input.tripId,
    name,
    holderUid: input.holderUid,
    createdByUid: input.actorUid,
    createdAt: now,
    updatedAt: now,
  };
  await safeSetDoc(refDoc, fund);
  return fund;
}

export async function renameFund(input: {
  tripId: string;
  fund: Fund;
  name: string;
  actorUid: string;
}) {
  const actor = await loadActor(input.tripId, input.actorUid);
  if (!canManageFund(input.fund, actor)) throw new Error('Sem permissão para editar este caixa.');
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome ao caixa.');
  await safeUpdateDoc(doc(db, 'trips', input.tripId, 'funds', input.fund.id), {
    name,
    updatedAt: Date.now(),
  });
}

/** Only an empty fund (no movements, no expenses) can be removed. */
export async function deleteFund(input: { tripId: string; fund: Fund; actorUid: string }) {
  const actor = await loadActor(input.tripId, input.actorUid);
  if (!canManageFund(input.fund, actor)) throw new Error('Sem permissão para excluir este caixa.');
  const [movements, expenses] = await Promise.all([
    getDocs(
      query(
        collection(db, 'trips', input.tripId, 'fundMovements'),
        where('fundId', '==', input.fund.id)
      )
    ),
    getDocs(
      query(collection(db, 'trips', input.tripId, 'expenses'), where('fundId', '==', input.fund.id))
    ),
  ]);
  const active = movements.docs.filter((d) => (d.data() as FundMovement).status !== 'rejected');
  if (active.length || !expenses.empty) {
    throw new Error('O caixa tem aportes ou gastos. Exclua-os antes de remover o caixa.');
  }
  await Promise.all([
    ...movements.docs.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(db, 'trips', input.tripId, 'funds', input.fund.id)),
  ]);
}

/**
 * Record one or more movements. Holder/admin/finance lead records them confirmed;
 * a regular member can only declare their own contribution, which waits for confirmation.
 */
export async function addFundMovements(input: {
  tripId: string;
  fund: Fund;
  type: FundMovementType;
  entries: { memberUid: string; amount: number }[];
  note?: string;
  actorUid: string;
}) {
  const actor = await loadActor(input.tripId, input.actorUid);
  const manager = canManageFund(input.fund, actor);
  const entries = input.entries
    .map((e) => ({ memberUid: e.memberUid, amount: round2(e.amount) }))
    .filter((e) => e.amount > 0);
  if (!entries.length) throw new Error('Informe um valor maior que zero.');
  if (!manager) {
    if (input.type === 'refund') {
      throw new Error('Só quem guarda o caixa, o admin ou o financeiro registram devoluções.');
    }
    if (entries.some((e) => e.memberUid !== actor.uid)) {
      throw new Error('Você só pode registrar o seu próprio aporte.');
    }
  }

  const batch = writeBatch(db);
  const now = Date.now();
  const created: FundMovement[] = [];
  entries.forEach((entry, index) => {
    const refDoc = doc(collection(db, 'trips', input.tripId, 'fundMovements'));
    const movement = omitUndefinedDeep({
      id: refDoc.id,
      tripId: input.tripId,
      fundId: input.fund.id,
      type: input.type,
      memberUid: entry.memberUid,
      holderUid: input.fund.holderUid,
      amount: entry.amount,
      status: manager ? ('confirmed' as const) : ('pending' as const),
      note: input.note?.trim() || undefined,
      createdByUid: actor.uid,
      // Keep batch order stable in the history list.
      createdAt: now + index,
      confirmedByUid: manager ? actor.uid : undefined,
      confirmedAt: manager ? now : undefined,
    }) as FundMovement;
    safeBatchSet(batch, refDoc, movement);
    created.push(movement);
  });
  await batch.commit();
  return created;
}

export async function resolveFundMovement(input: {
  tripId: string;
  fund: Fund;
  movement: FundMovement;
  status: 'confirmed' | 'rejected';
  actorUid: string;
}) {
  const actor = await loadActor(input.tripId, input.actorUid);
  if (!canManageFund(input.fund, actor)) {
    throw new Error('Só quem guarda o caixa, o admin ou o financeiro confirmam aportes.');
  }
  if (input.movement.status !== 'pending') throw new Error('Este aporte já foi resolvido.');
  await safeUpdateDoc(doc(db, 'trips', input.tripId, 'fundMovements', input.movement.id), {
    status: input.status,
    confirmedByUid: actor.uid,
    confirmedAt: Date.now(),
  });
}

/** Managers can delete any movement; members can withdraw their own pending one. */
export async function deleteFundMovement(input: {
  tripId: string;
  fund: Fund;
  movement: FundMovement;
  actorUid: string;
}) {
  const actor = await loadActor(input.tripId, input.actorUid);
  const ownPending =
    input.movement.status === 'pending' && input.movement.createdByUid === actor.uid;
  if (!ownPending && !canManageFund(input.fund, actor)) {
    throw new Error('Sem permissão para remover este registro.');
  }
  await deleteDoc(doc(db, 'trips', input.tripId, 'fundMovements', input.movement.id));
}
