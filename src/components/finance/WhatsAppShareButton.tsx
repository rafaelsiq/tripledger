import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  onPress: () => void;
  loading?: boolean;
  label?: string;
};

/** Full-width share action for expense summaries (keeps headers uncluttered). */
export function WhatsAppShareButton({
  onPress,
  loading = false,
  label = 'Exportar para WhatsApp',
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        loading && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.finance} />
      ) : (
        <Ionicons name="logo-whatsapp" size={20} color={colors.finance} />
      )}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.financeSoft,
    borderWidth: 1,
    borderColor: '#D0DAE4',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  label: {
    color: colors.finance,
    fontFamily: fonts.uiBold,
    fontSize: 14,
  },
});
