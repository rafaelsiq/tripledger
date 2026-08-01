import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function FinanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.finance,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Finanças' }} />
      <Stack.Screen name="new" options={{ title: 'Novo lançamento', presentation: 'modal' }} />
      <Stack.Screen name="expense/[expenseId]" options={{ title: 'Despesa' }} />
      <Stack.Screen name="report" options={{ title: 'Relatório final' }} />
    </Stack>
  );
}
