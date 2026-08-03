import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExpenseKind } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type FabOption = {
  id: ExpenseKind;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: FabOption[] = [
  {
    id: 'planned',
    label: 'Despesa prevista',
    hint: 'Planejada antes da viagem',
    icon: 'calendar-outline',
  },
  {
    id: 'actual',
    label: 'Despesa da viagem',
    hint: 'Gasto durante a execução',
    icon: 'wallet-outline',
  },
  {
    id: 'income',
    label: 'Receita',
    hint: 'Entrada de valor no grupo',
    icon: 'trending-up-outline',
  },
];

type Props = {
  tripId: string;
};

/** Bottom-right + FAB with new lançamento shortcuts. */
export function FinanceFab({ tripId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(kind: ExpenseKind) {
    setOpen(false);
    router.push(`/(app)/trip/${tripId}/finance/new?kind=${kind}`);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Novo lançamento"
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={styles.menu}>
              <Text style={styles.menuTitle}>Novo lançamento</Text>
              {OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => go(option.id)}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name={option.icon} size={20} color={colors.finance} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionHint}>{option.hint}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityLabel="Fechar"
              style={({ pressed }) => [styles.fab, styles.fabClose, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="close" size={26} color={colors.white} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.finance,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    elevation: 6,
    zIndex: 20,
  },
  fabClose: {
    position: 'relative',
    right: 0,
    bottom: 0,
    alignSelf: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: 2,
    ...shadows.card,
  },
  menuTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  optionPressed: {
    backgroundColor: colors.financeSoft,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.financeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
  },
  optionHint: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkSoft,
  },
});
