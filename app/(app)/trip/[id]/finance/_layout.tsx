import { Stack } from 'expo-router';
import { TripHomeBackButton } from '@/src/components/TripHomeBackButton';
import { colors, fonts } from '@/src/theme';

export default function FinanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.uiSemi },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Finanças', headerLeft: () => <TripHomeBackButton /> }}
      />
      <Stack.Screen name="new" options={{ title: 'Novo lançamento', presentation: 'modal' }} />
      <Stack.Screen
        name="edit/[expenseId]"
        options={{ title: 'Editar lançamento', presentation: 'modal' }}
      />
      <Stack.Screen name="expense/[expenseId]" options={{ title: 'Despesa' }} />
      <Stack.Screen name="report" options={{ title: 'Relatório final' }} />
    </Stack>
  );
}
