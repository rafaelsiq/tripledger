import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExpenseForm } from '@/src/components/finance/ExpenseForm';
import { Body, Button, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useTrip } from '@/src/hooks/useTrip';
import { canManageExpense } from '@/src/services/expenses';

export default function EditExpenseScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { expenses, isAdmin, isFinanceLead, canMutate } = useTrip();
  const { user } = useAuth();
  const router = useRouter();
  const expense = expenses.find((e) => e.id === expenseId);

  if (!expense) {
    return (
      <Screen>
        <Body muted>Lançamento não encontrado.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const allowed =
    !!user &&
    canMutate &&
    canManageExpense(expense, {
      uid: user.uid,
      isAdmin,
      isFinanceLead,
    });

  if (!allowed) {
    return (
      <Screen>
        <Body muted>
          Apenas quem lançou este gasto, o admin ou o responsável financeiro podem editá-lo.
        </Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return <ExpenseForm mode="edit" initialExpense={expense} />;
}
