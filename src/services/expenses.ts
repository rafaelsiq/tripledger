import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/src/lib/firebase';
import { equalSplits, splitStatus } from '@/src/lib/finance';
import type {
  ConsolidationRequest,
  Expense,
  ExpenseCategory,
  ExpenseKind,
  Payment,
  Settlement,
} from '@/src/types';

async function uploadTripFile(
  tripId: string,
  folder: string,
  uri: string,
  contentType = 'image/jpeg'
) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storageRef = ref(storage, `trips/${tripId}/${filename}`);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

export { uploadTripFile };

export function subscribeExpenses(
  tripId: string,
  cb: (expenses: Expense[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trips', tripId, 'expenses'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as Expense));
  });
}

export function subscribePayments(
  tripId: string,
  cb: (payments: Payment[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trips', tripId, 'payments'), orderBy('paidAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as Payment));
  });
}

export function subscribeConsolidationRequests(
  tripId: string,
  cb: (reqs: ConsolidationRequest[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'trips', tripId, 'consolidationRequests'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConsolidationRequest)));
  });
}

export function subscribeSettlements(
  tripId: string,
  cb: (items: Settlement[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'trips', tripId, 'settlements'), (snap) => {
    cb(snap.docs.map((d) => d.data() as Settlement));
  });
}

export async function createExpense(input: {
  tripId: string;
  kind: ExpenseKind;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidByUid: string;
  memberIds: string[];
  customSplits?: { uid: string; amount: number }[];
  note?: string;
  receiptUrl?: string;
  dueDate?: string;
  createdByUid: string;
}) {
  const splits = input.customSplits
    ? input.customSplits.map((s) => ({
        uid: s.uid,
        amount: s.amount,
        paidAmount: s.uid === input.paidByUid ? s.amount : 0,
        status: splitStatus(s.uid === input.paidByUid ? s.amount : 0, s.amount),
      }))
    : equalSplits(input.memberIds, input.amount).map((s) => ({
        ...s,
        paidAmount: s.uid === input.paidByUid ? s.amount : 0,
        status: splitStatus(s.uid === input.paidByUid ? s.amount : 0, s.amount),
      }));

  if (input.kind === 'income') {
    splits.forEach((s) => {
      s.paidAmount = s.amount;
      s.status = 'paid';
    });
  }

  const refDoc = doc(collection(db, 'trips', input.tripId, 'expenses'));
  const now = Date.now();
  const expense: Expense = {
    id: refDoc.id,
    tripId: input.tripId,
    kind: input.kind,
    title: input.title.trim(),
    category: input.category,
    amount: input.amount,
    paidByUid: input.paidByUid,
    splits,
    note: input.note,
    receiptUrl: input.receiptUrl,
    dueDate: input.dueDate,
    createdByUid: input.createdByUid,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(refDoc, expense);
  return expense;
}

export async function registerPayment(input: {
  tripId: string;
  expenseId: string;
  fromUid: string;
  toUid: string;
  amount: number;
  proofUri?: string;
  note?: string;
}) {
  let proofUrl: string | undefined;
  if (input.proofUri) {
    proofUrl = await uploadTripFile(input.tripId, 'proofs', input.proofUri);
  }
  const refDoc = doc(collection(db, 'trips', input.tripId, 'payments'));
  const payment: Payment = {
    id: refDoc.id,
    tripId: input.tripId,
    expenseId: input.expenseId,
    fromUid: input.fromUid,
    toUid: input.toUid,
    amount: input.amount,
    proofUrl,
    paidAt: Date.now(),
    status: 'pending',
    note: input.note,
  };
  await setDoc(refDoc, payment);
  return payment;
}

export async function confirmPayment(input: {
  tripId: string;
  payment: Payment;
  confirmedByUid: string;
  expense: Expense;
}) {
  await setDoc(
    doc(db, 'trips', input.tripId, 'payments', input.payment.id),
    {
      ...input.payment,
      status: 'confirmed',
      confirmedByUid: input.confirmedByUid,
      confirmedAt: Date.now(),
    },
    { merge: true }
  );

  const splits = input.expense.splits.map((s) => {
    if (s.uid !== input.payment.fromUid) return s;
    const paidAmount = Math.min(s.amount, s.paidAmount + input.payment.amount);
    return {
      ...s,
      paidAmount,
      status: splitStatus(paidAmount, s.amount),
    };
  });

  await updateDoc(doc(db, 'trips', input.tripId, 'expenses', input.expense.id), {
    splits,
    updatedAt: Date.now(),
  });
}

export async function rejectPayment(tripId: string, paymentId: string) {
  await updateDoc(doc(db, 'trips', tripId, 'payments', paymentId), {
    status: 'rejected',
  });
}

export async function requestConsolidation(input: {
  tripId: string;
  paymentId: string;
  fromUid: string;
  toUid: string;
}) {
  const refDoc = doc(collection(db, 'trips', input.tripId, 'consolidationRequests'));
  const req: ConsolidationRequest = {
    id: refDoc.id,
    tripId: input.tripId,
    paymentId: input.paymentId,
    fromUid: input.fromUid,
    toUid: input.toUid,
    status: 'pending',
    createdAt: Date.now(),
  };
  await setDoc(refDoc, req);
  return req;
}

export async function resolveConsolidationRequest(
  tripId: string,
  reqId: string,
  status: 'approved' | 'rejected',
  resolvedByUid: string
) {
  await updateDoc(doc(db, 'trips', tripId, 'consolidationRequests', reqId), {
    status,
    resolvedAt: Date.now(),
    resolvedByUid,
  });
}

export async function saveSettlements(
  tripId: string,
  settlements: Omit<Settlement, 'id' | 'tripId' | 'createdAt' | 'status'>[]
) {
  for (const item of settlements) {
    const refDoc = doc(collection(db, 'trips', tripId, 'settlements'));
    const settlement: Settlement = {
      id: refDoc.id,
      tripId,
      fromUid: item.fromUid,
      toUid: item.toUid,
      amount: item.amount,
      status: 'open',
      createdAt: Date.now(),
    };
    await setDoc(refDoc, settlement);
  }
}

export async function markSettlementSettled(
  tripId: string,
  settlementId: string,
  proofUri?: string
) {
  let proofUrl: string | undefined;
  if (proofUri) {
    proofUrl = await uploadTripFile(tripId, 'settlements', proofUri);
  }
  await updateDoc(doc(db, 'trips', tripId, 'settlements', settlementId), {
    status: 'settled',
    settledAt: Date.now(),
    proofUrl,
  });
}

export async function deleteExpense(tripId: string, expenseId: string) {
  await deleteDoc(doc(db, 'trips', tripId, 'expenses', expenseId));
}
