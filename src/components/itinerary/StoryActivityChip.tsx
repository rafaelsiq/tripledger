import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatItemSchedule, itemKind } from '@/src/lib/itineraryStory';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  item: ItineraryItem;
  onPress: () => void;
};

/** Compact highlight row for storytelling day chapters. */
export function StoryActivityChip({ item, onPress }: Props) {
  const schedule = formatItemSchedule(item);
  const isRest = itemKind(item) === 'rest';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        isRest && styles.chipRest,
        pressed && { opacity: 0.88 },
      ]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, isRest && styles.thumbRest]}>
          <Text style={[styles.thumbLetter, isRest && styles.thumbLetterRest]}>
            {item.title.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.body}>
        {schedule ? (
          <Text style={[styles.time, isRest && styles.timeRest]}>{schedule}</Text>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.location ? (
          <Text style={styles.location} numberOfLines={1}>
            {item.location}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  chipRest: {
    backgroundColor: colors.financeSoft,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRest: {
    backgroundColor: '#D7E3EC',
  },
  thumbLetter: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.accent,
  },
  thumbLetterRest: {
    color: colors.finance,
  },
  body: { flex: 1, gap: 2 },
  time: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  timeRest: {
    color: colors.finance,
  },
  title: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.ink,
  },
  location: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkMuted,
  },
});
