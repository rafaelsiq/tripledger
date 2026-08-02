import type { Expense, ExpenseInstallment, ExpenseSplit, TripMember } from '@/src/types';
import { splitStatus } from '@/src/lib/finance';

export function isDummyMember(member?: TripMember | null): boolean {
  return !!member?.isDummy || !!member?.uid?.startsWith('dummy_');
}

export function generateDummyUid(): string {
  return `dummy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Remap a split list from dummyUid → realUid, merging if both exist. */
export function remapSplits(
  splits: ExpenseSplit[],
  dummyUid: string,
  realUid: string
): ExpenseSplit[] {
  const dummy = splits.find((s) => s.uid === dummyUid);
  const real = splits.find((s) => s.uid === realUid);
  const others = splits.filter((s) => s.uid !== dummyUid && s.uid !== realUid);

  if (!dummy && !real) return splits;
  if (dummy && !real) {
    return [...others, { ...dummy, uid: realUid }];
  }
  if (!dummy && real) return splits;

  const amount = (dummy?.amount || 0) + (real?.amount || 0);
  const paidAmount = Math.min(amount, (dummy?.paidAmount || 0) + (real?.paidAmount || 0));
  const installmentCount =
    dummy?.installmentCount || real?.installmentCount
      ? Math.max(dummy?.installmentCount || 1, real?.installmentCount || 1)
      : undefined;
  return [
    ...others,
    {
      uid: realUid,
      amount,
      paidAmount,
      status: splitStatus(paidAmount, amount),
      ...(installmentCount ? { installmentCount } : {}),
    },
  ];
}

function remapInstallments(
  installments: ExpenseInstallment[] | undefined,
  dummyUid: string,
  realUid: string
): ExpenseInstallment[] | undefined {
  if (!installments?.length) return installments;
  return installments.map((item) =>
    item.uid === dummyUid ? { ...item, uid: realUid } : item
  );
}

export function remapExpenseUids(
  expense: Expense,
  dummyUid: string,
  realUid: string
): Expense {
  return {
    ...expense,
    paidByUid: expense.paidByUid === dummyUid ? realUid : expense.paidByUid,
    splits: remapSplits(expense.splits, dummyUid, realUid),
    installments: remapInstallments(expense.installments, dummyUid, realUid),
  };
}

export function memberLabel(member: TripMember): string {
  return member.isDummy ? `${member.displayName} (provisório)` : member.displayName;
}
