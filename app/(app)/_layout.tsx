import { Stack } from 'expo-router';
import { TripSwitcher } from '@/src/components/TripSwitcher';
import { UserTripsProvider } from '@/src/hooks/useUserTrips';
import { colors, fonts } from '@/src/theme';

export default function AppLayout() {
  return (
    <UserTripsProvider>
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
        <Stack.Screen name="index" />
        <Stack.Screen name="trip/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="trip/join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      </Stack>
    </UserTripsProvider>
  );
}
