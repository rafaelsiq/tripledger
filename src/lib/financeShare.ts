import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { paymentProgress } from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import type { Expense, Trip, TripMember } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { formatCurrency } from '@/src/theme';

function money(value: number, currency = 'BRL') {
  return formatCurrency(Math.round(value * 100) / 100, currency);
}

function nameOf(members: TripMember[], uid: string): string {
  const member = members.find((m) => m.uid === uid);
  return member ? memberLabel(member) : 'Membro';
}

function round2(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function expensePaidTotal(expense: Expense) {
  return round2(expense.splits.reduce((sum, split) => sum + split.paidAmount, 0));
}

function splitLines(expense: Expense, members: TripMember[], currency: string): string[] {
  return expense.splits.map((split) => {
    const remaining = round2(split.amount - split.paidAmount);
    const isPayer = split.uid === expense.paidByUid;
    const status =
      remaining <= 0.01
        ? 'ok'
        : split.paidAmount > 0
          ? `pagou ${money(split.paidAmount, currency)}, falta ${money(remaining, currency)}`
          : `falta ${money(remaining, currency)}`;
    const payerTag = isPayer ? ' (pagou a despesa)' : '';
    if (status === 'ok') {
      return `• ${nameOf(members, split.uid)}${payerTag}: ${money(split.amount, currency)} — quitado`;
    }
    return `• ${nameOf(members, split.uid)}${payerTag}: deve ${money(split.amount, currency)} (${status})`;
  });
}

/** WhatsApp-ready summary for a single expense. */
export function buildExpenseWhatsAppSummary(input: {
  trip: Trip;
  expense: Expense;
  members: TripMember[];
}): string {
  const { trip, expense, members } = input;
  const currency = trip.currency || 'BRL';
  const paid = expensePaidTotal(expense);
  const open = round2(expense.amount - paid);
  const lines = [
    `*${expense.title}*`,
    `Viagem: ${trip.name}`,
    `${CATEGORY_LABELS[expense.category] || expense.category}`,
    '',
    `Valor total: ${money(expense.amount, currency)}`,
    `Pago por: ${nameOf(members, expense.paidByUid)}`,
    `Já pago: ${money(paid, currency)}`,
    `Em aberto: ${money(open, currency)}`,
    '',
    '*Quem precisa pagar*',
    ...splitLines(expense, members, currency),
    '',
    '_Resumo gerado no TripLedger_',
  ];
  return lines.join('\n');
}

/** WhatsApp-ready summary for all trip expenses (lançamentos). */
export function buildTripExpensesWhatsAppSummary(input: {
  trip: Trip;
  expenses: Expense[];
  members: TripMember[];
}): string {
  const { trip, expenses, members } = input;
  const currency = trip.currency || 'BRL';
  const progress = paymentProgress(expenses);
  const billable = expenses
    .filter((e) => e.kind !== 'income')
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);

  const lines: string[] = [
    `*Resumo de despesas — ${trip.name}*`,
    '',
    `Total: ${money(progress.total, currency)}`,
    `Já pago: ${money(progress.paid, currency)}`,
    `Em aberto: ${money(progress.open, currency)}`,
  ];

  if (!billable.length) {
    lines.push('', 'Nenhuma despesa lançada ainda.', '', '_Resumo gerado no TripLedger_');
    return lines.join('\n');
  }

  for (const expense of billable) {
    const paid = expensePaidTotal(expense);
    const open = round2(expense.amount - paid);
    lines.push(
      '',
      `*${expense.title}*`,
      `${CATEGORY_LABELS[expense.category] || expense.category} · ${money(expense.amount, currency)}`,
      `Pago por: ${nameOf(members, expense.paidByUid)}`,
      `Já pago: ${money(paid, currency)} · Em aberto: ${money(open, currency)}`,
      ...splitLines(expense, members, currency)
    );
  }

  lines.push('', '_Resumo gerado no TripLedger_');
  return lines.join('\n');
}

export class FinanceShareCancelledError extends Error {
  constructor() {
    super('SHARE_CANCELLED');
    this.name = 'FinanceShareCancelledError';
  }
}

/**
 * Opens the system share sheet (WhatsApp appears when installed).
 * Falls back to copying the message when sharing is unavailable.
 * Returns `'shared' | 'copied'`. Throws on hard failure; cancel is silent via FinanceShareCancelledError.
 */
export async function shareFinanceSummary(input: {
  title: string;
  message: string;
}): Promise<'shared' | 'copied'> {
  const { title, message } = input;
  try {
    const canNativeShare =
      typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    if (canNativeShare) {
      await navigator.share({ title, text: message });
      return 'shared';
    }
    const result = await Share.share({ message, title });
    if (result.action === Share.dismissedAction) {
      throw new FinanceShareCancelledError();
    }
    return 'shared';
  } catch (e) {
    if (e instanceof FinanceShareCancelledError) throw e;
    const errMessage = e instanceof Error ? e.message : '';
    if (
      /cancel|dismiss|AbortError/i.test(errMessage) ||
      (e as { name?: string })?.name === 'AbortError'
    ) {
      throw new FinanceShareCancelledError();
    }
    await Clipboard.setStringAsync(message);
    return 'copied';
  }
}
