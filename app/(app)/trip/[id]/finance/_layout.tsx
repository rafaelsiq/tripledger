import { Stack } from 'expo-router';
import { TripHomeBackButton } from '@/src/components/TripHomeBackButton';
import { TripSwitcher } from '@/src/components/TripSwitcher';
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
        headerTitle: () => <TripSwitcher />,
        headerTitleAlign: 'left',
      }}
    >
      <Stack.Screen name="index" options={{ headerLeft: () => <TripHomeBackButton /> }} />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit/[expenseId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="expense/[expenseId]" />
      <Stack.Screen name="report" />
    </Stack>
  );
}
