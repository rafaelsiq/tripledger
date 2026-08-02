import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/src/lib/firebase';
import { omitUndefinedDeep, safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import {
  amountsMatchTotal,
  applyPaidToInstallments,
  buildInstallments,
  clampInstallmentCount,
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
  ExpenseSplit,
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
  // Firestore rejects `undefined` fields (including nested) — omit them.
  const expense = omitUndefinedDeep({
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
  }) as unknown as Expense;
  await safeSetDoc(refDoc, expense);
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
  const payment = omitUndefinedDeep({
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
  }) as unknown as Payment;
  await safeSetDoc(refDoc, payment);
  return payment;
}

export async function confirmPayment(input: {
  tripId: string;
  payment: Payment;
  confirmedByUid: string;
  expense: Expense;
}) {
  await safeSetDoc(
    doc(db, 'trips', input.tripId, 'payments', input.payment.id),
    omitUndefinedDeep({
      ...input.payment,
      status: 'confirmed',
      confirmedByUid: input.confirmedByUid,
      confirmedAt: Date.now(),
    }),
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

  await safeUpdateDoc(
    doc(db, 'trips', input.tripId, 'expenses', input.expense.id),
    omitUndefinedDeep({
      splits,
      installments,
      updatedAt: Date.now(),
    })
  );
}

export async function rejectPayment(tripId: string, paymentId: string) {
  await safeUpdateDoc(doc(db, 'trips', tripId, 'payments', paymentId), {
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
  await safeSetDoc(refDoc, req);
  return req;
}

export async function resolveConsolidationRequest(
  tripId: string,
  reqId: string,
  status: 'approved' | 'rejected',
  resolvedByUid: string
) {
  await safeUpdateDoc(doc(db, 'trips', tripId, 'consolidationRequests', reqId), {
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
    await safeSetDoc(refDoc, settlement);
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
  await safeUpdateDoc(
    doc(db, 'trips', tripId, 'settlements', settlementId),
    omitUndefinedDeep({
      status: 'settled',
      settledAt: Date.now(),
      proofUrl,
    })
  );
}

function buildSplitsForExpense(input: {
  kind: ExpenseKind;
  amount: number;
  paidByUid: string;
  memberIds: string[];
  customSplits?: { uid: string; amount: number; installmentCount?: number }[];
  defaultInstallmentCount: number;
  previousPaid?: Record<string, number>;
}): ExpenseSplit[] {
  const defaultCount = input.defaultInstallmentCount;
  const previousPaid = input.previousPaid || {};

  const splits = input.customSplits
    ? input.customSplits.map((s) => {
        const amount = Math.round(s.amount * 100) / 100;
        const installmentCount =
          s.uid === input.paidByUid
            ? 1
            : clampInstallmentCount(s.installmentCount, defaultCount);
        const preserved =
          s.uid === input.paidByUid
            ? amount
            : Math.min(amount, Math.max(0, previousPaid[s.uid] || 0));
        return {
          uid: s.uid,
          amount,
          paidAmount: preserved,
          status: splitStatus(preserved, amount),
          installmentCount,
        };
      })
    : equalSplits(input.memberIds, input.amount).map((s) => {
        const preserved =
          s.uid === input.paidByUid
            ? s.amount
            : Math.min(s.amount, Math.max(0, previousPaid[s.uid] || 0));
        return {
          ...s,
          paidAmount: preserved,
          status: splitStatus(preserved, s.amount),
          installmentCount: s.uid === input.paidByUid ? 1 : defaultCount,
        };
      });

  if (input.kind === 'income') {
    splits.forEach((s) => {
      s.paidAmount = s.amount;
      s.status = 'paid';
      s.installmentCount = 1;
    });
  }

  return splits;
}

function buildInstallmentsForExpense(input: {
  expenseId: string;
  kind: ExpenseKind;
  paidByUid: string;
  splits: ExpenseSplit[];
  defaultInstallmentCount: number;
}): ExpenseInstallment[] {
  if (input.kind === 'income') return [];
  return input.splits.flatMap((s) => {
    if (s.uid === input.paidByUid || s.amount <= 0) return [];
    return buildInstallments({
      uid: s.uid,
      total: s.amount,
      count: s.installmentCount ?? input.defaultInstallmentCount,
      idPrefix: `${input.expenseId}_${s.uid}`,
    });
  });
}

export async function updateExpense(input: {
  tripId: string;
  expenseId: string;
  existing: Expense;
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
  clearReceipt?: boolean;
  dueDate?: string;
}) {
  const defaultCount = clampInstallmentCount(input.defaultInstallmentCount, 1);

  if (input.customSplits?.length) {
    if (!amountsMatchTotal(input.customSplits.map((s) => s.amount), input.amount)) {
      throw new Error('A soma das partes deve ser igual ao valor total.');
    }
  }

  const previousPaid = Object.fromEntries(
    input.existing.splits.map((s) => [s.uid, s.paidAmount])
  );

  const splits = buildSplitsForExpense({
    kind: input.kind,
    amount: input.amount,
    paidByUid: input.paidByUid,
    memberIds: input.memberIds,
    customSplits: input.customSplits,
    defaultInstallmentCount: defaultCount,
    previousPaid,
  });

  let installments = buildInstallmentsForExpense({
    expenseId: input.expenseId,
    kind: input.kind,
    paidByUid: input.paidByUid,
    splits,
    defaultInstallmentCount: defaultCount,
  });

  if (installments.length) {
    const paidForInstallments = Object.fromEntries(
      splits
        .filter((s) => s.uid !== input.paidByUid)
        .map((s) => [s.uid, s.paidAmount])
    );
    installments = applyPaidToInstallments(installments, paidForInstallments);
  }

  const validInstallmentIds = new Set(installments.map((i) => i.id));
  const paymentsSnap = await getDocs(
    query(
      collection(db, 'trips', input.tripId, 'payments'),
      where('expenseId', '==', input.expenseId)
    )
  );

  await Promise.all(
    paymentsSnap.docs.map(async (paymentDoc) => {
      const payment = paymentDoc.data() as Payment;
      if (payment.status !== 'pending') return;
      const stillValid =
        !!payment.installmentId && validInstallmentIds.has(payment.installmentId);
      if (stillValid) return;
      const fallback = nextOpenInstallment(installments, payment.fromUid)?.id;
      const next = { ...payment };
      if (fallback) next.installmentId = fallback;
      else delete next.installmentId;
      await safeSetDoc(paymentDoc.ref, omitUndefinedDeep(next));
    })
  );

  const receiptUrl = input.clearReceipt
    ? undefined
    : input.receiptUrl !== undefined
      ? input.receiptUrl
      : input.existing.receiptUrl;

  const payload = omitUndefinedDeep({
    kind: input.kind,
    title: input.title.trim(),
    category: input.category,
    amount: input.amount,
    paidByUid: input.paidByUid,
    splits,
    installments: installments.length ? installments : null,
    note: input.note?.trim() || null,
    receiptUrl: receiptUrl || null,
    dueDate: input.dueDate || null,
    updatedAt: Date.now(),
  });

  await safeSetDoc(doc(db, 'trips', input.tripId, 'expenses', input.expenseId), payload, {
    merge: true,
  });
}

export async function deleteExpense(tripId: string, expenseId: string) {
  const paymentsSnap = await getDocs(
    query(
      collection(db, 'trips', tripId, 'payments'),
      where('expenseId', '==', expenseId)
    )
  );
  const paymentIds = new Set(paymentsSnap.docs.map((d) => d.id));

  const consolidationSnap = await getDocs(
    collection(db, 'trips', tripId, 'consolidationRequests')
  );
  const relatedConsolidation = consolidationSnap.docs.filter((d) =>
    paymentIds.has((d.data() as ConsolidationRequest).paymentId)
  );

  await Promise.all([
    ...paymentsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...relatedConsolidation.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(db, 'trips', tripId, 'expenses', expenseId)),
  ]);
}
