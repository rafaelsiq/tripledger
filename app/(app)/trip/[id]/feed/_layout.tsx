import { Stack } from 'expo-router';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0C0A09' },
        headerTintColor: '#FFF7ED',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0C0A09' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Feed da viagem' }} />
      <Stack.Screen name="new" options={{ title: 'Novo post', presentation: 'modal' }} />
    </Stack>
  );
}
