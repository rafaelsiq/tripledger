import { Stack } from 'expo-router';
import { TripHomeBackButton } from '@/src/components/TripHomeBackButton';
import { TripSwitcher } from '@/src/components/TripSwitcher';
import { colors, fonts } from '@/src/theme';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.uiSemi },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerTitle: () => <TripSwitcher />,
        headerTitleAlign: 'left',
      }}
    >
      <Stack.Screen name="index" options={{ headerLeft: () => <TripHomeBackButton /> }} />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
