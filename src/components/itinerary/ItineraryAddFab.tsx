import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

/** Floating "+ Atividade" button, same pattern as the finance FAB. */
export function ItineraryAddFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Nova atividade neste dia"
      style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <Ionicons name="add" size={20} color={colors.white} />
      <Text style={styles.fabText}>Atividade</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.raised,
    elevation: 6,
    zIndex: 20,
  },
  fabText: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.white },
});
