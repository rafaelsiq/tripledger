import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatItemSchedule, itemKind } from '@/src/lib/itineraryStory';
import { useLayout } from '@/src/hooks/useLayout';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type Props = {
  timeLabel: string;
  items: ItineraryItem[];
  canAdd: boolean;
  width: number;
  isLast: boolean;
  onAdd: () => void;
  onOpenItem: (item: ItineraryItem) => void;
};

/**
 * Fixed-width hour column for the horizontal day rail.
 * Empty hours always show an add affordance.
 */
export function StoryHourColumn({
  timeLabel,
  items,
  canAdd,
  width,
  isLast,
  onAdd,
  onOpenItem,
}: Props) {
  const { isWide } = useLayout();

  return (
    <View
      style={[
        styles.wrap,
        !isWide && styles.wrapMobile,
        { width },
        !isLast && (isWide ? styles.wrapGap : styles.wrapGapMobile),
      ]}
    >
      <Text style={styles.time}>{timeLabel}</Text>

      {items.length ? (
        <View style={styles.items}>
          {items.map((item) => {
            const schedule = formatItemSchedule(item);
            const isRest = itemKind(item) === 'rest';
            return (
              <Pressable
                key={item.id}
                onPress={() => onOpenItem(item)}
                style={({ pressed }) => [
                  styles.itemCard,
                  isRest && styles.itemCardRest,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Text
                  style={[styles.itemTime, isRest && styles.itemTimeRest]}
                  numberOfLines={2}
                >
                  {schedule || timeLabel}
                </Text>
                <Text style={styles.itemTitle} numberOfLines={3}>
                  {item.title}
                </Text>
                {item.location ? (
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {item.location}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {canAdd ? (
            <Pressable
              onPress={onAdd}
              accessibilityLabel={`Adicionar outra atividade às ${timeLabel}`}
              style={({ pressed }) => [styles.addChip, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={styles.addChipText}>Adicionar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={canAdd ? onAdd : undefined}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar atividade às ${timeLabel}`}
          style={({ pressed }) => [
            styles.emptyCard,
            !isWide && styles.emptyCardMobile,
            pressed && canAdd && { opacity: 0.9 },
            !canAdd && { opacity: 0.75 },
          ]}
        >
          {canAdd ? (
            <>
              <View style={styles.plusCircle}>
                <Ionicons name="add" size={22} color={colors.accent} />
              </View>
              <Text style={styles.hint}>Adicionar</Text>
            </>
          ) : (
            <Text style={styles.hintMuted}>Livre</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    flexGrow: 0,
    minHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  wrapGap: {
    marginRight: spacing.md,
  },
  wrapGapMobile: {
    marginRight: spacing.sm,
  },
  time: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  wrapMobile: {
    minHeight: 200,
    padding: spacing.sm,
    borderRadius: radii.lg,
  },
  items: {
    gap: spacing.sm,
    flex: 1,
  },
  itemCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 2,
  },
  itemCardRest: {
    backgroundColor: colors.financeSoft,
  },
  itemTime: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    color: colors.accent,
  },
  itemTimeRest: {
    color: colors.finance,
  },
  itemTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.ink,
  },
  itemMeta: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkMuted,
  },
  emptyCard: {
    flex: 1,
    minHeight: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  emptyCardMobile: {
    minHeight: 120,
  },
  plusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accent,
  },
  hintMuted: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkMuted,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#C6E3DB',
    paddingVertical: 8,
  },
  addChipText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.accent,
  },
});
