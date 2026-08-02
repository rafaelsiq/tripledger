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
import {
  amountsMatchTotal,
  buildInstallments,
  equalSplits,
  nextOpenInstallment,
  splitStatus,
} from '@/src/lib/finance';
import type {
  ConsolidationRequest,
  Expense,
  ExpenseCategory,
  ExpenseInstallment,
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

function clampInstallmentCount(value?: number, fallback = 1) {
  const n = Math.round(value ?? fallback);
  return Math.max(1, Math.min(24, Number.isFinite(n) ? n : fallback));
}

function applyPaymentToInstallment(
  installment: ExpenseInstallment,
  paymentAmount: number
): ExpenseInstallment {
  const paidAmount = Math.min(
    installment.amount,
    Math.round((installment.paidAmount + paymentAmount) * 100) / 100
  );
  return {
    ...installment,
    paidAmount,
    status: splitStatus(paidAmount, installment.amount),
  };
}

export async function createExpense(input: {
  tripId: string;
  kind: ExpenseKind;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidByUid: string;
  memberIds: string[];
  customSplits?: { uid: string; amount: number; installmentCount?: number }[];
  defaultInstallmentCount?: number;
  note?: string;
  receiptUrl?: string;
  dueDate?: string;
  createdByUid: string;
}) {
  const defaultCount = clampInstallmentCount(input.defaultInstallmentCount, 1);

  if (input.customSplits?.length) {
    if (!amountsMatchTotal(input.customSplits.map((s) => s.amount), input.amount)) {
      throw new Error('A soma das partes deve ser igual ao valor total.');
    }
  }

  const splits = input.customSplits
    ? input.customSplits.map((s) => {
        const installmentCount =
          s.uid === input.paidByUid
            ? 1
            : clampInstallmentCount(s.installmentCount, defaultCount);
        return {
          uid: s.uid,
          amount: Math.round(s.amount * 100) / 100,
          paidAmount: s.uid === input.paidByUid ? Math.round(s.amount * 100) / 100 : 0,
          status: splitStatus(
            s.uid === input.paidByUid ? s.amount : 0,
            s.amount
          ),
          installmentCount,
        };
      })
    : equalSplits(input.memberIds, input.amount).map((s) => ({
        ...s,
        paidAmount: s.uid === input.paidByUid ? s.amount : 0,
        status: splitStatus(s.uid === input.paidByUid ? s.amount : 0, s.amount),
        installmentCount: s.uid === input.paidByUid ? 1 : defaultCount,
      }));

  if (input.kind === 'income') {
    splits.forEach((s) => {
      s.paidAmount = s.amount;
      s.status = 'paid';
      s.installmentCount = 1;
    });
  }

  const refDoc = doc(collection(db, 'trips', input.tripId, 'expenses'));
  const installments =
    input.kind === 'income'
      ? []
      : splits.flatMap((s) => {
          if (s.uid === input.paidByUid || s.amount <= 0) return [];
          return buildInstallments({
            uid: s.uid,
            total: s.amount,
            count: s.installmentCount ?? defaultCount,
            idPrefix: `${refDoc.id}_${s.uid}`,
          });
        });

  const now = Date.now();
  // Firestore rejects `undefined` fields — only persist defined optionals.
  const expense = Object.fromEntries(
    Object.entries({
      id: refDoc.id,
      tripId: input.tripId,
      kind: input.kind,
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      paidByUid: input.paidByUid,
      splits,
      installments: installments.length ? installments : undefined,
      note: input.note?.trim() || undefined,
      receiptUrl: input.receiptUrl,
      dueDate: input.dueDate || undefined,
      createdByUid: input.createdByUid,
      createdAt: now,
      updatedAt: now,
    }).filter(([, v]) => v !== undefined)
  ) as unknown as Expense;
  await setDoc(refDoc, expense);
  return expense;
}

export async function registerPayment(input: {
  tripId: string;
  expenseId: string;
  fromUid: string;
  toUid: string;
  amount: number;
  installmentId?: string;
  proofUri?: string;
  note?: string;
  /** Optional expense snapshot to validate installment without an extra read. */
  expense?: Expense;
}) {
  let installmentId = input.installmentId;
  const expense = input.expense;
  if (expense?.installments?.length) {
    if (installmentId) {
      const installment = expense.installments.find((i) => i.id === installmentId);
      if (!installment || installment.uid !== input.fromUid) {
        throw new Error('Parcela inválida para este pagamento.');
      }
    } else {
      installmentId = nextOpenInstallment(expense.installments, input.fromUid)?.id;
    }
  }

  let proofUrl: string | undefined;
  if (input.proofUri) {
    proofUrl = await uploadTripFile(input.tripId, 'proofs', input.proofUri);
  }
  const refDoc = doc(collection(db, 'trips', input.tripId, 'payments'));
  const payment = Object.fromEntries(
    Object.entries({
      id: refDoc.id,
      tripId: input.tripId,
      expenseId: input.expenseId,
      fromUid: input.fromUid,
      toUid: input.toUid,
      amount: input.amount,
      installmentId,
      proofUrl,
      paidAt: Date.now(),
      status: 'pending' as const,
      note: input.note?.trim() || undefined,
    }).filter(([, v]) => v !== undefined)
  ) as unknown as Payment;
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

  let installments = input.expense.installments;
  if (installments?.length) {
    if (input.payment.installmentId) {
      installments = installments.map((item) =>
        item.id === input.payment.installmentId
          ? applyPaymentToInstallment(item, input.payment.amount)
          : item
      );
    } else {
      let remaining = input.payment.amount;
      installments = installments.map((item) => {
        if (item.uid !== input.payment.fromUid || remaining <= 0 || item.status === 'paid') {
          return item;
        }
        const open = Math.round((item.amount - item.paidAmount) * 100) / 100;
        const applied = Math.min(open, remaining);
        remaining = Math.round((remaining - applied) * 100) / 100;
        return applyPaymentToInstallment(item, applied);
      });
    }
  }

  await updateDoc(
    doc(db, 'trips', input.tripId, 'expenses', input.expense.id),
    Object.fromEntries(
      Object.entries({
        splits,
        installments,
        updatedAt: Date.now(),
      }).filter(([, v]) => v !== undefined)
    )
  );
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
