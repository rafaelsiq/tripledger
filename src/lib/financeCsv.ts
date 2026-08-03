import { memberBalance, paymentProgress } from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import type { Expense, Payment, Trip, TripMember } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';

const KIND_LABELS: Record<Expense['kind'], string> = {
  planned: 'Previsto',
  actual: 'Realizado',
  income: 'Receita',
};

const PAYMENT_STATUS: Record<Payment['status'], string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  rejected: 'Rejeitado',
};

function escapeCell(value: string | number): string {
  const text = String(value ?? '');
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(cells: Array<string | number>): string {
  return cells.map(escapeCell).join(';');
}

function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2).replace('.', ',');
}

function nameOf(members: TripMember[], uid: string): string {
  const member = members.find((m) => m.uid === uid);
  return member ? memberLabel(member) : uid;
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'viagem'
  );
}

export function financeCsvFilename(trip: Trip): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `tripledger-${slugify(trip.name)}-${stamp}.csv`;
}

/** UTF-8 CSV (`;` separator) with lançamentos, pagamentos, totais e membros. */
export function buildFinanceCsv(input: {
  trip: Trip;
  expenses: Expense[];
  payments: Payment[];
  members: TripMember[];
}): string {
  const { trip, expenses, payments, members } = input;
  const progress = paymentProgress(expenses);
  const lines: string[] = [];

  lines.push(row(['Viagem', trip.name]));
  lines.push(row(['Destino', trip.destination || '']));
  lines.push(row(['Moeda', trip.currency || 'BRL']));
  lines.push(row(['Exportado em', new Date().toISOString()]));
  lines.push('');

  lines.push(row(['TOTAIS']));
  lines.push(row(['Total despesas', money(progress.total)]));
  lines.push(row(['Pago', money(progress.paid)]));
  lines.push(row(['Em aberto', money(progress.open)]));
  lines.push('');

  lines.push(
    row([
      'LANCAMENTOS',
      'Tipo',
      'Categoria',
      'Valor',
      'Pago',
      'Em aberto',
      'Pago por',
      'Nota',
      'Criado em',
    ])
  );
  const sortedExpenses = expenses.slice().sort((a, b) => a.createdAt - b.createdAt);
  for (const expense of sortedExpenses) {
    const paid = expense.splits.reduce((s, sp) => s + sp.paidAmount, 0);
    const open = Math.max(0, expense.amount - paid);
    lines.push(
      row([
        expense.title,
        KIND_LABELS[expense.kind],
        CATEGORY_LABELS[expense.category] || expense.category,
        money(expense.amount),
        money(paid),
        money(open),
        nameOf(members, expense.paidByUid),
        expense.note || '',
        new Date(expense.createdAt).toISOString(),
      ])
    );
  }
  lines.push('');

  lines.push(row(['RATEIOS', 'Lançamento', 'Membro', 'Deve', 'Pagou', 'Status']));
  for (const expense of sortedExpenses) {
    if (expense.kind === 'income') continue;
    for (const split of expense.splits) {
      lines.push(
        row([
          '',
          expense.title,
          nameOf(members, split.uid),
          money(split.amount),
          money(split.paidAmount),
          split.status,
        ])
      );
    }
  }
  lines.push('');

  lines.push(row(['PAGAMENTOS', 'De', 'Para', 'Valor', 'Status', 'Data', 'Nota']));
  const sortedPayments = payments.slice().sort((a, b) => a.paidAt - b.paidAt);
  for (const payment of sortedPayments) {
    lines.push(
      row([
        '',
        nameOf(members, payment.fromUid),
        nameOf(members, payment.toUid),
        money(payment.amount),
        PAYMENT_STATUS[payment.status],
        new Date(payment.paidAt).toISOString(),
        payment.note || '',
      ])
    );
  }
  lines.push('');

  lines.push(row(['MEMBROS', 'Deve (rateio)', 'Já pagou', 'Em aberto']));
  for (const member of members) {
    const balance = memberBalance(member.uid, expenses, payments);
    lines.push(
      row([
        memberLabel(member),
        money(balance.owed),
        money(balance.paid),
        money(balance.netOwed),
      ])
    );
  }

  return lines.join('\r\n');
}
