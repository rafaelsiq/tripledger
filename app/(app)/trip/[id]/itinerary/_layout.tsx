import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function ItineraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0C0A09' },
        headerTintColor: '#FFF7ED',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0C0A09' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Roteiro' }} />
      <Stack.Screen name="day/[dayId]" options={{ title: 'Dia' }} />
      <Stack.Screen name="new-item" options={{ title: 'Novo item', presentation: 'modal' }} />
    </Stack>
  );
}
