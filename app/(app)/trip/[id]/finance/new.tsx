import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpenseForm } from '@/src/components/finance/ExpenseForm';
import type { ExpenseKind } from '@/src/types';

function parseKind(value?: string): ExpenseKind | undefined {
  if (value === 'planned' || value === 'actual' || value === 'income') return value;
  return undefined;
}

export default function NewExpenseScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <ExpenseForm mode="create" initialKind={parseKind(kind)} />;
}
