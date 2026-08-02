import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpenseForm } from '@/src/components/finance/ExpenseForm';
import { Body, Button, Screen } from '@/src/components/ui';
import { useTrip } from '@/src/hooks/useTrip';
import { useRouter } from 'expo-router';

export default function EditExpenseScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { expenses } = useTrip();
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

  return <ExpenseForm mode="edit" initialExpense={expense} />;
}
