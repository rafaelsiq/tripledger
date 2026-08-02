import { Stack } from 'expo-router';
import { colors, fonts } from '@/src/theme';

export default function ItineraryLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Roteiro' }} />
      <Stack.Screen name="day/[dayId]" options={{ title: 'Dia' }} />
      <Stack.Screen name="item/[itemId]" options={{ title: 'Atividade' }} />
      <Stack.Screen
        name="new-item"
        options={{ title: 'Nova atividade', presentation: 'modal' }}
      />
      <Stack.Screen
        name="edit-item"
        options={{ title: 'Editar atividade', presentation: 'modal' }}
      />
    </Stack>
  );
}
