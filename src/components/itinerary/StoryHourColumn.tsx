import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StoryTimelineRow } from '@/src/components/itinerary/StoryTimelineRow';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type Props = {
  timeLabel: string;
  items: ItineraryItem[];
  canAdd: boolean;
  cardWidth: number;
  emptyWidth: number;
  isLast: boolean;
  onAdd: () => void;
  onOpenItem: (item: ItineraryItem) => void;
};

/** One hour column on the horizontal storytelling day track. */
export function StoryHourColumn({
  timeLabel,
  items,
  canAdd,
  cardWidth,
  emptyWidth,
  isLast,
  onAdd,
  onOpenItem,
}: Props) {
  if (!items.length) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={canAdd ? onAdd : undefined}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar atividade às ${timeLabel}`}
          style={({ pressed }) => [
            styles.emptyCard,
            { width: emptyWidth },
            pressed && canAdd && { opacity: 0.9 },
            !canAdd && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.time}>{timeLabel}</Text>
          <View style={styles.emptyBody}>
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
          </View>
        </Pressable>
        {!isLast ? <View style={styles.connector} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.filled}>
        {items.map((item, index) => (
          <StoryTimelineRow
            key={item.id}
            item={item}
            timeLabel={item.time?.trim() || timeLabel}
            cardWidth={cardWidth}
            isLast={index === items.length - 1 && !canAdd && isLast}
            onPress={() => onOpenItem(item)}
          />
        ))}
        {canAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityLabel={`Adicionar outra atividade às ${timeLabel}`}
            style={({ pressed }) => [styles.addMore, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={styles.addMoreText}>{timeLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {!isLast ? <View style={styles.connector} /> : null}
    </View>
  );
}

function timeLabelOf(item: ItineraryItem, fallback: string) {
  return item.time?.trim() || fallback;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filled: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyCard: {
    minHeight: 180,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    ...shadows.card,
  },
  time: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
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
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#C6E3DB',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginLeft: 4,
  },
  addMoreText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.accent,
  },
  connector: {
    width: 28,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
});
