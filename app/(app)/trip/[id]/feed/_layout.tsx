import { Stack } from 'expo-router';
import { TripHomeBackButton } from '@/src/components/TripHomeBackButton';
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
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Feed da viagem', headerLeft: () => <TripHomeBackButton /> }}
      />
      <Stack.Screen name="new" options={{ title: 'Novo post', presentation: 'modal' }} />
    </Stack>
  );
}
