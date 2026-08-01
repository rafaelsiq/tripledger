import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Minhas viagens' }} />
      <Stack.Screen name="trip/new" options={{ title: 'Nova viagem', presentation: 'modal' }} />
      <Stack.Screen name="trip/join" options={{ title: 'Entrar com código', presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
