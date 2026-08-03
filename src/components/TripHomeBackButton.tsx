import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/src/theme';

/** Leaves the trip tabs and returns to the trips list. */
export function TripHomeBackButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar para minhas viagens"
      onPress={() => router.replace('/(app)')}
      hitSlop={12}
      style={({ pressed }) => [{ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="chevron-back" size={28} color={colors.ink} />
    </Pressable>
  );
}
