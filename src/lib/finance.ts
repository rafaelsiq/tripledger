import type {
  Expense,
  ExpenseInstallment,
  ExpenseSplit,
  Fund,
  FundMovement,
  Payment,
  Settlement,
} from '@/src/types';

export function generateInviteCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Upper bound for repayment installment schedules. */
export const MAX_INSTALLMENT_COUNT = 48;

export function clampInstallmentCount(value?: number, fallback = 1) {
  const n = Math.round(value ?? fallback);
  return Math.max(1, Math.min(MAX_INSTALLMENT_COUNT, Number.isFinite(n) ? n : fallback));
}

/** Split total cents as evenly as possible across n parts. */
export function distributeCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const safeTotal = Math.max(0, Math.round(totalCents));
  const base = Math.floor(safeTotal / parts);
  let remainder = safeTotal - base * parts;
  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
  });
}

export function equalSplits(memberIds: string[], total: number): ExpenseSplit[] {
  if (memberIds.length === 0) return [];
  const parts = distributeCents(Math.round(total * 100), memberIds.length);
  return memberIds.map((uid, index) => ({
    uid,
    amount: (parts[index] || 0) / 100,
    paidAmount: 0,
    status: 'pending' as const,
  }));
}

export function splitStatus(paid: number, owed: number): ExpenseSplit['status'] {
  if (paid <= 0) return 'pending';
  if (paid + 0.009 >= owed) return 'paid';
  return 'partial';
}

export function buildInstallments(input: {
  uid: string;
  total: number;
  count: number;
  idPrefix: string;
  dueDates?: (string | undefined)[];
}): ExpenseInstallment[] {
  const count = clampInstallmentCount(input.count, 1);
  const parts = distributeCents(Math.round(input.total * 100), count);
  return parts.map((cents, index) => {
    const dueDate = input.dueDates?.[index];
    return {
      id: `${input.idPrefix}_${index + 1}`,
      uid: input.uid,
      index: index + 1,
      amount: cents / 100,
      paidAmount: 0,
      status: 'pending' as const,
      ...(dueDate ? { dueDate } : {}),
    };
  });
}

export function sumAmounts(values: number[]): number {
  return Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100;
}

export function amountsMatchTotal(parts: number[], total: number, tolerance = 0.02): boolean {
  return Math.abs(sumAmounts(parts) - total) <= tolerance;
}

export function nextOpenInstallment(
  installments: ExpenseInstallment[] | undefined,
  uid: string
): ExpenseInstallment | undefined {
  if (!installments?.length) return undefined;
  return installments
    .filter((i) => i.uid === uid && i.status !== 'paid')
    .sort((a, b) => a.index - b.index)[0];
}

/** Apply a paid total onto a fresh installment schedule, in index order. */
export function applyPaidToInstallments(
  installments: ExpenseInstallment[],
  paidByUid: Record<string, number>
): ExpenseInstallment[] {
  const remainingPaid: Record<string, number> = { ...paidByUid };
  return installments
    .slice()
    .sort((a, b) => a.uid.localeCompare(b.uid) || a.index - b.index)
    .map((item) => {
      const available = Math.max(0, remainingPaid[item.uid] || 0);
      const applied = Math.min(item.amount, available);
      remainingPaid[item.uid] = Math.round((available - applied) * 100) / 100;
      return {
        ...item,
        paidAmount: applied,
        status: splitStatus(applied, item.amount),
      };
    });
}

export function memberBalance(uid: string, expenses: Expense[], payments: Payment[]) {
  let owed = 0;
  let paid = 0;
  let lent = 0;

  for (const expense of expenses) {
    if (expense.kind === 'income') continue;
    const split = expense.splits.find((s) => s.uid === uid);
    if (split) {
      owed += split.amount;
      paid += split.paidAmount;
    }
    if (expense.paidByUid === uid) {
      lent += expense.amount;
    }
  }

  const confirmedToMe = payments
    .filter((p) => p.toUid === uid && p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);
  const confirmedFromMe = payments
    .filter((p) => p.fromUid === uid && p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingFromMe = payments
    .filter((p) => p.fromUid === uid && p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const netOwed = Math.max(0, owed - paid);
  const isUpToDate = netOwed <= 0.01;

  return {
    owed,
    paid,
    lent,
    netOwed,
    pendingFromMe,
    confirmedToMe,
    confirmedFromMe,
    isUpToDate,
    status: isUpToDate ? ('em_dia' as const) : pendingFromMe > 0 ? ('aguardando' as const) : ('pendente' as const),
  };
}

/** Minimize cash transfers between members (debt simplification). */
export function simplifyDebts(
  balances: Record<string, number>
): Omit<Settlement, 'id' | 'tripId' | 'createdAt' | 'status'>[] {
  const debtors: { uid: string; amount: number }[] = [];
  const creditors: { uid: string; amount: number }[] = [];

  Object.entries(balances).forEach(([uid, value]) => {
    if (value < -0.01) debtors.push({ uid, amount: -value });
    if (value > 0.01) creditors.push({ uid, amount: value });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const result: Omit<Settlement, 'id' | 'tripId' | 'createdAt' | 'status'>[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i]!.amount, creditors[j]!.amount);
    result.push({
      fromUid: debtors[i]!.uid,
      toUid: creditors[j]!.uid,
      amount: Math.round(pay * 100) / 100,
    });
    debtors[i]!.amount -= pay;
    creditors[j]!.amount -= pay;
    if (debtors[i]!.amount < 0.01) i += 1;
    if (creditors[j]!.amount < 0.01) j += 1;
  }

  return result;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Gross position per member from expenses only (ignores any repayment):
 * positive = fronted more than their share, negative = consumed more than they fronted.
 * Use computeLedgerBalances for "who still owes whom".
 */
export function computeNetBalances(expenses: Expense[]): Record<string, number> {
  const balances: Record<string, number> = {};

  for (const expense of expenses) {
    if (expense.kind === 'income') continue;
    balances[expense.paidByUid] = (balances[expense.paidByUid] || 0) + expense.amount;
    for (const split of expense.splits) {
      balances[split.uid] = (balances[split.uid] || 0) - split.amount;
    }
  }

  return balances;
}

/**
 * Current position per member after every money movement:
 * expenses (payer fronted, splits consumed), income (receiver holds the others' share),
 * confirmed payments, settled settlements and confirmed fund contributions/refunds.
 * positive = should receive, negative = still owes. Sums to ~0 across the group.
 */
export function computeLedgerBalances(input: {
  expenses: Expense[];
  payments?: Payment[];
  settlements?: Settlement[];
  fundMovements?: FundMovement[];
}): Record<string, number> {
  const balances: Record<string, number> = {};
  const add = (uid: string, value: number) => {
    balances[uid] = (balances[uid] || 0) + value;
  };

  for (const expense of input.expenses) {
    const sign = expense.kind === 'income' ? -1 : 1;
    add(expense.paidByUid, sign * expense.amount);
    for (const split of expense.splits) {
      add(split.uid, -sign * split.amount);
    }
  }

  for (const payment of input.payments || []) {
    if (payment.status !== 'confirmed') continue;
    add(payment.fromUid, payment.amount);
    add(payment.toUid, -payment.amount);
  }

  for (const settlement of input.settlements || []) {
    if (settlement.status !== 'settled') continue;
    add(settlement.fromUid, settlement.amount);
    add(settlement.toUid, -settlement.amount);
  }

  for (const movement of input.fundMovements || []) {
    if (movement.status !== 'confirmed') continue;
    // Contribution: member hands cash to the holder. Refund: holder hands it back.
    const fromUid = movement.type === 'contribution' ? movement.memberUid : movement.holderUid;
    const toUid = movement.type === 'contribution' ? movement.holderUid : movement.memberUid;
    add(fromUid, movement.amount);
    add(toUid, -movement.amount);
  }

  for (const uid of Object.keys(balances)) {
    balances[uid] = round2(balances[uid] || 0);
  }
  return balances;
}

/** What each member consumed: their share of costs minus their share of income. */
export function computeConsumption(expenses: Expense[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const expense of expenses) {
    const sign = expense.kind === 'income' ? -1 : 1;
    for (const split of expense.splits) {
      result[split.uid] = round2((result[split.uid] || 0) + sign * split.amount);
    }
  }
  return result;
}

export type FundMemberSummary = {
  uid: string;
  contributed: number;
  refunded: number;
  /** Share of the costs paid from the fund (net of income received into it). */
  consumed: number;
  /** contributed − refunded − consumed. Positive = still has money in the fund. */
  balance: number;
};

export type FundSummary = {
  fund: Fund;
  contributed: number;
  refunded: number;
  spent: number;
  received: number;
  pendingContributions: number;
  /** Cash that should be with the holder right now. Negative = holder covered the gap. */
  balance: number;
  expenses: Expense[];
  movements: FundMovement[];
  members: FundMemberSummary[];
};

export function fundSummary(
  fund: Fund,
  allMovements: FundMovement[],
  allExpenses: Expense[]
): FundSummary {
  const movements = allMovements.filter((m) => m.fundId === fund.id);
  const expenses = allExpenses.filter((e) => e.fundId === fund.id);
  const perMember = new Map<string, FundMemberSummary>();
  const entry = (uid: string) => {
    let item = perMember.get(uid);
    if (!item) {
      item = { uid, contributed: 0, refunded: 0, consumed: 0, balance: 0 };
      perMember.set(uid, item);
    }
    return item;
  };

  let contributed = 0;
  let refunded = 0;
  let pendingContributions = 0;
  for (const movement of movements) {
    if (movement.status === 'pending' && movement.type === 'contribution') {
      pendingContributions += movement.amount;
    }
    if (movement.status !== 'confirmed') continue;
    if (movement.type === 'contribution') {
      contributed += movement.amount;
      entry(movement.memberUid).contributed += movement.amount;
    } else {
      refunded += movement.amount;
      entry(movement.memberUid).refunded += movement.amount;
    }
  }

  let spent = 0;
  let received = 0;
  for (const expense of expenses) {
    const sign = expense.kind === 'income' ? -1 : 1;
    if (sign > 0) spent += expense.amount;
    else received += expense.amount;
    for (const split of expense.splits) {
      entry(split.uid).consumed += sign * split.amount;
    }
  }

  const members = Array.from(perMember.values()).map((item) => {
    const contributedR = round2(item.contributed);
    const refundedR = round2(item.refunded);
    const consumedR = round2(item.consumed);
    return {
      uid: item.uid,
      contributed: contributedR,
      refunded: refundedR,
      consumed: consumedR,
      balance: round2(contributedR - refundedR - consumedR),
    };
  });

  return {
    fund,
    contributed: round2(contributed),
    refunded: round2(refunded),
    spent: round2(spent),
    received: round2(received),
    pendingContributions: round2(pendingContributions),
    balance: round2(contributed - refunded - spent + received),
    expenses,
    movements,
    members,
  };
}

/** Open (not fully repaid) splits a member owes on expenses someone else paid. */
export function openSplitsFor(uid: string, expenses: Expense[]) {
  return expenses
    .filter((e) => e.kind !== 'income' && !e.fundId && e.paidByUid !== uid)
    .map((expense) => {
      const split = expense.splits.find((s) => s.uid === uid);
      if (!split) return null;
      const remaining = round2(split.amount - split.paidAmount);
      if (remaining <= 0.01) return null;
      return { expense, split, remaining };
    })
    .filter((item): item is { expense: Expense; split: ExpenseSplit; remaining: number } => !!item);
}

/** Calendar day of an expense: explicit date, else the day it was logged. */
export function expenseDay(expense: Pick<Expense, 'date' | 'createdAt'>): string {
  if (expense.date) return expense.date;
  const d = new Date(expense.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function expenseTotals(expenses: Expense[]) {
  let planned = 0;
  let actual = 0;
  let income = 0;
  for (const expense of expenses) {
    if (expense.kind === 'planned') planned += expense.amount;
    else if (expense.kind === 'actual') actual += expense.amount;
    else if (expense.kind === 'income') income += expense.amount;
  }
  return { planned, actual, income };
}

/** Billable expense total vs how much members have already paid toward splits. */
export function paymentProgress(expenses: Expense[]) {
  const billable = expenses.filter((e) => e.kind !== 'income');
  let total = 0;
  let paid = 0;
  for (const expense of billable) {
    total += expense.amount;
    for (const split of expense.splits) {
      paid += split.paidAmount;
    }
  }
  total = Math.round(total * 100) / 100;
  paid = Math.round(paid * 100) / 100;
  const open = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { total, paid, open, billable };
}

export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
