import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/src/lib/firebase';
import {
  omitUndefinedDeep,
  safeBatchUpdate,
  safeSetDoc,
  safeUpdateDoc,
} from '@/src/lib/firestore';
import {
  amountsMatchTotal,
  applyPaidToInstallments,
  buildInstallments,
  clampInstallmentCount,
  equalSplits,
  nextOpenInstallment,
  round2,
  splitStatus,
} from '@/src/lib/finance';
import { closedTripMemberMessage, canMutateTrip } from '@/src/lib/tripPhase';
import { getTrip } from '@/src/services/trips';
import type {
  ConsolidationRequest,
  Expense,
  ExpenseCategory,
  ExpenseInstallment,
  ExpenseKind,
  ExpenseSplit,
  Fund,
  Payment,
  Settlement,
} from '@/src/types';

/** Author of the lançamento, trip admin, or finance lead. */
export function canManageExpense(
  expense: Pick<Expense, 'createdByUid'>,
  actor: { uid: string; isAdmin: boolean; isFinanceLead?: boolean }
) {
  if (actor.isAdmin || actor.isFinanceLead) return true;
  return !!expense.createdByUid && expense.createdByUid === actor.uid;
}

async function assertCanManageExpense(input: {
  tripId: string;
  expense: Expense;
  actorUid: string;
}) {
  const trip = await getTrip(input.tripId);
  if (!trip) throw new Error('Viagem não encontrada.');
  const isAdmin = trip.adminUid === input.actorUid;
  const isFinanceLead = trip.financeLeadUid === input.actorUid;
  if (!canMutateTrip(trip, { isAdmin, isFinanceLead })) {
    throw new Error(closedTripMemberMessage());
  }
  if (
    !canManageExpense(input.expense, {
      uid: input.actorUid,
      isAdmin,
      isFinanceLead,
    })
  ) {
    throw new Error('Apenas quem lançou, o admin ou o responsável financeiro podem alterar este lançamento.');
  }
  return trip;
}

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

async function getFund(tripId: string, fundId: string) {
  const snap = await getDoc(doc(db, 'trips', tripId, 'funds', fundId));
  if (!snap.exists()) throw new Error('Caixa não encontrado.');
  return snap.data() as Fund;
}

function canManageFinance(trip: { adminUid: string; financeLeadUid: string }, uid: string) {
  return trip.adminUid === uid || trip.financeLeadUid === uid;
}

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
  /** Day the cost happened (YYYY-MM-DD). */
  date?: string;
  /** Pay from (or receive into) this fund; paidByUid becomes its holder. */
  fundId?: string;
  createdByUid: string;
}) {
  const defaultCount = clampInstallmentCount(input.defaultInstallmentCount, 1);
  if (!(input.amount > 0)) throw new Error('Informe um valor maior que zero.');

  if (input.customSplits?.length) {
    if (!amountsMatchTotal(input.customSplits.map((s) => s.amount), input.amount)) {
      throw new Error('A soma das partes deve ser igual ao valor total.');
    }
  }

  const fund = input.fundId ? await getFund(input.tripId, input.fundId) : null;
  const paidByUid = fund ? fund.holderUid : input.paidByUid;

  const refDoc = doc(collection(db, 'trips', input.tripId, 'expenses'));
  const splits = buildSplitsForExpense({
    kind: input.kind,
    amount: input.amount,
    paidByUid,
    memberIds: input.memberIds,
    customSplits: input.customSplits,
    defaultInstallmentCount: defaultCount,
    coveredByFund: !!fund,
  });
  const installments = buildInstallmentsForExpense({
    expenseId: refDoc.id,
    kind: input.kind,
    paidByUid,
    splits,
    defaultInstallmentCount: defaultCount,
    coveredByFund: !!fund,
  });

  const now = Date.now();
  // Firestore rejects `undefined` fields (including nested) — omit them.
  const expense = omitUndefinedDeep({
    id: refDoc.id,
    tripId: input.tripId,
    kind: input.kind,
    title: input.title.trim(),
    category: input.category,
    amount: round2(input.amount),
    paidByUid,
    splits,
    installments: installments.length ? installments : undefined,
    note: input.note?.trim() || undefined,
    receiptUrl: input.receiptUrl,
    dueDate: input.dueDate || undefined,
    date: input.date || undefined,
    fundId: fund?.id,
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
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new Error('Informe um valor maior que zero.');
  if (input.fromUid === input.toUid) throw new Error('Quem pagou a despesa não deve a si mesmo.');

  const expenseSnap = await getDoc(doc(db, 'trips', input.tripId, 'expenses', input.expenseId));
  if (!expenseSnap.exists()) throw new Error('Lançamento não encontrado.');
  const expense = expenseSnap.data() as Expense;
  if (expense.fundId) {
    throw new Error('Este gasto saiu do caixa — não há reembolso individual a registrar.');
  }
  const split = expense.splits.find((s) => s.uid === input.fromUid);
  if (!split) throw new Error('Esta pessoa não participa deste lançamento.');
  const pendingSnap = await getDocs(
    query(
      collection(db, 'trips', input.tripId, 'payments'),
      where('expenseId', '==', input.expenseId)
    )
  );
  const pendingAmount = pendingSnap.docs
    .map((d) => d.data() as Payment)
    .filter((p) => p.status === 'pending' && p.fromUid === input.fromUid)
    .reduce((sum, p) => sum + p.amount, 0);
  const available = round2(split.amount - split.paidAmount - pendingAmount);
  if (amount > available + 0.009) {
    throw new Error(
      available <= 0.009
        ? 'Não há valor em aberto: o restante já foi pago ou aguarda confirmação.'
        : `O valor passa do que falta pagar (${available.toFixed(2).replace('.', ',')}).`
    );
  }

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
    amount,
    installmentId,
    proofUrl,
    paidAt: Date.now(),
    status: 'pending' as const,
    note: input.note?.trim() || undefined,
  }) as unknown as Payment;
  await safeSetDoc(refDoc, payment);
  return payment;
}

function applyPaymentToExpense(expense: Expense, payment: Payment, direction: 1 | -1) {
  const delta = direction * payment.amount;
  const splits = expense.splits.map((s) => {
    if (s.uid !== payment.fromUid) return s;
    const paidAmount = Math.max(0, Math.min(s.amount, round2(s.paidAmount + delta)));
    return { ...s, paidAmount, status: splitStatus(paidAmount, s.amount) };
  });

  let installments = expense.installments;
  if (installments?.length && direction === -1) {
    // Reversal: rebuild the debtor's schedule from what is still paid.
    const paidByUid = Object.fromEntries(
      splits.filter((s) => s.uid !== expense.paidByUid).map((s) => [s.uid, s.paidAmount])
    );
    installments = applyPaidToInstallments(installments, paidByUid);
  } else if (installments?.length) {
    if (payment.installmentId && installments.some((i) => i.id === payment.installmentId)) {
      installments = installments.map((item) =>
        item.id === payment.installmentId ? applyPaymentToInstallment(item, payment.amount) : item
      );
    } else {
      let remaining = payment.amount;
      installments = installments
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => {
          if (item.uid !== payment.fromUid || remaining <= 0 || item.status === 'paid') {
            return item;
          }
          const open = round2(item.amount - item.paidAmount);
          const applied = Math.min(open, remaining);
          remaining = round2(remaining - applied);
          return applyPaymentToInstallment(item, applied);
        });
    }
  }
  return { splits, installments };
}

/**
 * Confirm a pending payment and apply it to the expense split, atomically —
 * a payment can never be applied twice (double tap, two managers at once).
 */
export async function confirmPayment(input: {
  tripId: string;
  payment: Payment;
  confirmedByUid: string;
  /** Kept for callers; the transaction always re-reads the latest expense. */
  expense?: Expense;
}) {
  const paymentRef = doc(db, 'trips', input.tripId, 'payments', input.payment.id);
  const expenseRef = doc(db, 'trips', input.tripId, 'expenses', input.payment.expenseId);
  await runTransaction(db, async (tx) => {
    const [paymentSnap, expenseSnap] = await Promise.all([tx.get(paymentRef), tx.get(expenseRef)]);
    if (!paymentSnap.exists()) throw new Error('Pagamento não encontrado.');
    if (!expenseSnap.exists()) throw new Error('Lançamento não encontrado.');
    const payment = paymentSnap.data() as Payment;
    if (payment.status !== 'pending') throw new Error('Este pagamento já foi resolvido.');
    const expense = expenseSnap.data() as Expense;
    const { splits, installments } = applyPaymentToExpense(expense, payment, 1);
    tx.update(paymentRef, {
      status: 'confirmed',
      confirmedByUid: input.confirmedByUid,
      confirmedAt: Date.now(),
    });
    tx.update(
      expenseRef,
      omitUndefinedDeep({ splits, installments, updatedAt: Date.now() })
    );
  });
  await resolveRequestsForPayment(input.tripId, input.payment.id, 'approved', input.confirmedByUid);
}

/** Undo a confirmed payment (estorno): the amount goes back to "em aberto". Finance only. */
export async function reversePayment(input: {
  tripId: string;
  paymentId: string;
  actorUid: string;
}) {
  const trip = await getTrip(input.tripId);
  if (!trip || !canManageFinance(trip, input.actorUid)) {
    throw new Error('Apenas o admin ou o responsável financeiro podem estornar.');
  }
  const paymentRef = doc(db, 'trips', input.tripId, 'payments', input.paymentId);
  await runTransaction(db, async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error('Pagamento não encontrado.');
    const payment = paymentSnap.data() as Payment;
    if (payment.status !== 'confirmed') throw new Error('Só pagamentos confirmados podem ser estornados.');
    const expenseRef = doc(db, 'trips', input.tripId, 'expenses', payment.expenseId);
    const expenseSnap = await tx.get(expenseRef);
    tx.update(paymentRef, {
      status: 'rejected',
      reversedAt: Date.now(),
      reversedByUid: input.actorUid,
    });
    if (expenseSnap.exists()) {
      const { splits, installments } = applyPaymentToExpense(
        expenseSnap.data() as Expense,
        payment,
        -1
      );
      tx.update(expenseRef, omitUndefinedDeep({ splits, installments, updatedAt: Date.now() }));
    }
  });
}

/** The sender (or finance) withdraws a payment that was not confirmed yet. */
export async function cancelPayment(input: {
  tripId: string;
  payment: Payment;
  actorUid: string;
}) {
  if (input.payment.status !== 'pending') {
    throw new Error('Só pagamentos aguardando confirmação podem ser cancelados.');
  }
  if (input.payment.fromUid !== input.actorUid) {
    const trip = await getTrip(input.tripId);
    if (!trip || !canManageFinance(trip, input.actorUid)) {
      throw new Error('Só quem registrou ou o financeiro podem cancelar este pagamento.');
    }
  }
  const reqs = await getDocs(
    query(
      collection(db, 'trips', input.tripId, 'consolidationRequests'),
      where('paymentId', '==', input.payment.id)
    )
  );
  await Promise.all([
    ...reqs.docs.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(db, 'trips', input.tripId, 'payments', input.payment.id)),
  ]);
}

async function resolveRequestsForPayment(
  tripId: string,
  paymentId: string,
  status: 'approved' | 'rejected',
  resolvedByUid: string
) {
  const reqs = await getDocs(
    query(collection(db, 'trips', tripId, 'consolidationRequests'), where('paymentId', '==', paymentId))
  );
  await Promise.all(
    reqs.docs
      .filter((d) => (d.data() as ConsolidationRequest).status === 'pending')
      .map((d) =>
        safeUpdateDoc(d.ref, { status, resolvedAt: Date.now(), resolvedByUid })
      )
  );
}

export async function rejectPayment(tripId: string, paymentId: string, actorUid?: string) {
  await safeUpdateDoc(doc(db, 'trips', tripId, 'payments', paymentId), {
    status: 'rejected',
  });
  if (actorUid) await resolveRequestsForPayment(tripId, paymentId, 'rejected', actorUid);
}

export async function requestConsolidation(input: {
  tripId: string;
  paymentId: string;
  fromUid: string;
  toUid: string;
}) {
  const existing = await getDocs(
    query(
      collection(db, 'trips', input.tripId, 'consolidationRequests'),
      where('paymentId', '==', input.paymentId)
    )
  );
  if (existing.docs.some((d) => (d.data() as ConsolidationRequest).status === 'pending')) {
    throw new Error('Já existe uma solicitação aberta para este pagamento.');
  }
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
  const batch = writeBatch(db);
  const now = Date.now();
  for (const item of settlements) {
    const refDoc = doc(collection(db, 'trips', tripId, 'settlements'));
    const settlement: Settlement = {
      id: refDoc.id,
      tripId,
      fromUid: item.fromUid,
      toUid: item.toUid,
      amount: item.amount,
      status: 'open',
      createdAt: now,
    };
    batch.set(refDoc, settlement);
  }
  await batch.commit();
}

/** Drop open (not yet paid) settlements so a fresh plan can be generated. */
export async function deleteOpenSettlements(tripId: string, actorUid: string) {
  const trip = await getTrip(tripId);
  if (!trip || !canManageFinance(trip, actorUid)) {
    throw new Error('Apenas o admin ou o responsável financeiro podem refazer o acerto.');
  }
  const snap = await getDocs(collection(db, 'trips', tripId, 'settlements'));
  await Promise.all(
    snap.docs
      .filter((d) => (d.data() as Settlement).status === 'open')
      .map((d) => deleteDoc(d.ref))
  );
}

/**
 * Mark a settlement paid. The amount is also applied to the payer's open splits on
 * expenses the receiver fronted (oldest first), so those lançamentos read as quitados.
 * Anything left over (debts routed through the simplification) only moves the ledger.
 */
export async function markSettlementSettled(
  tripId: string,
  settlementId: string,
  proofUri?: string
) {
  const settlementRef = doc(db, 'trips', tripId, 'settlements', settlementId);
  const settlementSnap = await getDoc(settlementRef);
  if (!settlementSnap.exists()) throw new Error('Acerto não encontrado.');
  const settlement = settlementSnap.data() as Settlement;
  if (settlement.status === 'settled') throw new Error('Este acerto já foi quitado.');

  let proofUrl: string | undefined;
  if (proofUri) {
    proofUrl = await uploadTripFile(tripId, 'settlements', proofUri);
  }

  const expensesSnap = await getDocs(
    query(collection(db, 'trips', tripId, 'expenses'), where('paidByUid', '==', settlement.toUid))
  );
  const batch = writeBatch(db);
  let remaining = settlement.amount;
  const candidates = expensesSnap.docs
    .map((d) => d.data() as Expense)
    .filter((e) => e.kind !== 'income' && !e.fundId)
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const expense of candidates) {
    if (remaining <= 0.009) break;
    const split = expense.splits.find((s) => s.uid === settlement.fromUid);
    if (!split) continue;
    const open = round2(split.amount - split.paidAmount);
    if (open <= 0.009) continue;
    const applied = Math.min(open, remaining);
    remaining = round2(remaining - applied);
    const splits = expense.splits.map((s) =>
      s.uid === split.uid
        ? {
            ...s,
            paidAmount: round2(s.paidAmount + applied),
            status: splitStatus(round2(s.paidAmount + applied), s.amount),
          }
        : s
    );
    const installments = expense.installments?.length
      ? applyPaidToInstallments(
          expense.installments,
          Object.fromEntries(
            splits.filter((s) => s.uid !== expense.paidByUid).map((s) => [s.uid, s.paidAmount])
          )
        )
      : expense.installments;
    safeBatchUpdate(batch, doc(db, 'trips', tripId, 'expenses', expense.id), {
      splits,
      installments,
      updatedAt: Date.now(),
    });
  }
  safeBatchUpdate(batch, settlementRef, {
    status: 'settled',
    settledAt: Date.now(),
    proofUrl,
  });
  await batch.commit();
}

function buildSplitsForExpense(input: {
  kind: ExpenseKind;
  amount: number;
  paidByUid: string;
  memberIds: string[];
  customSplits?: { uid: string; amount: number; installmentCount?: number }[];
  defaultInstallmentCount: number;
  previousPaid?: Record<string, number>;
  /** Paid from a fund: nobody repays the holder individually. */
  coveredByFund?: boolean;
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

  if (input.kind === 'income' || input.coveredByFund) {
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
  coveredByFund?: boolean;
}): ExpenseInstallment[] {
  if (input.kind === 'income' || input.coveredByFund) return [];
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
  actorUid: string;
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
  date?: string;
  fundId?: string;
}) {
  if (!(input.amount > 0)) throw new Error('Informe um valor maior que zero.');
  await assertCanManageExpense({
    tripId: input.tripId,
    expense: input.existing,
    actorUid: input.actorUid,
  });

  const defaultCount = clampInstallmentCount(input.defaultInstallmentCount, 1);

  if (input.customSplits?.length) {
    if (!amountsMatchTotal(input.customSplits.map((s) => s.amount), input.amount)) {
      throw new Error('A soma das partes deve ser igual ao valor total.');
    }
  }

  const fund = input.fundId ? await getFund(input.tripId, input.fundId) : null;
  const paidByUid = fund ? fund.holderUid : input.paidByUid;

  const paymentsSnap = await getDocs(
    query(
      collection(db, 'trips', input.tripId, 'payments'),
      where('expenseId', '==', input.expenseId)
    )
  );
  if (
    fund &&
    paymentsSnap.docs.some((d) => (d.data() as Payment).status !== 'rejected')
  ) {
    throw new Error(
      'Este lançamento já tem pagamentos registrados. Cancele-os antes de passá-lo para o caixa.'
    );
  }

  // Split "paid" flags of a fund/income expense are not real repayments — don't carry them over.
  const previousWasCovered = !!input.existing.fundId || input.existing.kind === 'income';
  const previousPaid = previousWasCovered
    ? {}
    : Object.fromEntries(input.existing.splits.map((s) => [s.uid, s.paidAmount]));

  const splits = buildSplitsForExpense({
    kind: input.kind,
    amount: input.amount,
    paidByUid,
    memberIds: input.memberIds,
    customSplits: input.customSplits,
    defaultInstallmentCount: defaultCount,
    previousPaid,
    coveredByFund: !!fund,
  });

  let installments = buildInstallmentsForExpense({
    expenseId: input.expenseId,
    kind: input.kind,
    paidByUid,
    splits,
    defaultInstallmentCount: defaultCount,
    coveredByFund: !!fund,
  });

  if (installments.length) {
    const paidForInstallments = Object.fromEntries(
      splits
        .filter((s) => s.uid !== paidByUid)
        .map((s) => [s.uid, s.paidAmount])
    );
    installments = applyPaidToInstallments(installments, paidForInstallments);
  }

  const validInstallmentIds = new Set(installments.map((i) => i.id));

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
    amount: round2(input.amount),
    paidByUid,
    splits,
    installments: installments.length ? installments : null,
    note: input.note?.trim() || null,
    receiptUrl: receiptUrl || null,
    dueDate: input.dueDate || null,
    date: input.date || null,
    fundId: fund?.id || null,
    updatedAt: Date.now(),
  });

  await safeSetDoc(doc(db, 'trips', input.tripId, 'expenses', input.expenseId), payload, {
    merge: true,
  });
}

export async function deleteExpense(tripId: string, expenseId: string, actorUid: string) {
  const expenseSnap = await getDoc(doc(db, 'trips', tripId, 'expenses', expenseId));
  if (!expenseSnap.exists()) throw new Error('Lançamento não encontrado.');
  const expense = { id: expenseSnap.id, ...(expenseSnap.data() as Omit<Expense, 'id'>) };
  await assertCanManageExpense({ tripId, expense, actorUid });

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
