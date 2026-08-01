import type { Expense, ExpenseSplit, Payment, Settlement } from '@/src/types';

export function generateInviteCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function equalSplits(memberIds: string[], total: number): ExpenseSplit[] {
  if (memberIds.length === 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / memberIds.length);
  let remainder = cents - base * memberIds.length;
  return memberIds.map((uid) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return {
      uid,
      amount: (base + extra) / 100,
      paidAmount: 0,
      status: 'pending' as const,
    };
  });
}

export function splitStatus(paid: number, owed: number): ExpenseSplit['status'] {
  if (paid <= 0) return 'pending';
  if (paid + 0.009 >= owed) return 'paid';
  return 'partial';
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

/**
 * Net balance per member from expenses:
 * positive = others owe them / they should receive
 * negative = they owe
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
