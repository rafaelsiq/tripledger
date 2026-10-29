import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ItineraryCard } from '@/src/components/itinerary/ItineraryCard';
import { DAY_PERIOD_LABELS, groupItemsByPeriod } from '@/src/lib/itineraryStory';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

type Props = {
  items: ItineraryItem[];
  onPressItem: (item: ItineraryItem) => void;
};

/** A day's items in clock order, with Manhã / Tarde / Noite / Sem horário separators. */
export function ItineraryDayTimeline({ items, onPressItem }: Props) {
  const { groups, showLabels } = useMemo(() => groupItemsByPeriod(items), [items]);

  return (
    <View>
      {groups.map((group, groupIndex) => (
        <View key={`${group.period}-${groupIndex}`}>
          {showLabels ? (
            <View style={[styles.period, groupIndex === 0 && styles.periodFirst]}>
              <Text style={styles.periodLabel}>{DAY_PERIOD_LABELS[group.period]}</Text>
              <View style={styles.periodRule} />
            </View>
          ) : null}
          {group.items.map((item, index) => (
            <ItineraryCard
              key={item.id}
              item={item}
              isLast={index === group.items.length - 1}
              onPress={() => onPressItem(item)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  period: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  periodFirst: { marginTop: 0 },
  periodLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  periodRule: { flex: 1, height: 1, backgroundColor: colors.divider },
});
