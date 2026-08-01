import { Stack } from 'expo-router';
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
      <Stack.Screen name="index" options={{ title: 'Feed da viagem' }} />
      <Stack.Screen name="new" options={{ title: 'Novo post', presentation: 'modal' }} />
    </Stack>
  );
}
