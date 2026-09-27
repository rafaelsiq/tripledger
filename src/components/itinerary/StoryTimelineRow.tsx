import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type Props = {
  item: ItineraryItem;
  timeLabel: string;
  onPress: () => void;
  isLast?: boolean;
};

/** Single activity on the storytelling day timeline. */
export function StoryTimelineRow({ item, timeLabel, onPress, isLast }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.rail}>
        <Text style={styles.time}>{timeLabel}</Text>
        <View style={styles.dot} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.card}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.fallbackText}>{item.title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.location ? (
            <Text style={styles.meta} numberOfLines={1}>
              {item.location}
            </Text>
          ) : null}
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 96,
  },
  rail: {
    width: 52,
    alignItems: 'center',
  },
  time: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.accent,
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.accentSoft,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
    minHeight: 40,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  image: {
    width: 84,
    minHeight: 84,
    alignSelf: 'stretch',
    backgroundColor: colors.accentSoft,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    color: colors.accent,
  },
  body: {
    flex: 1,
    gap: 4,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  title: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
  },
  meta: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkSoft,
  },
  desc: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 17,
  },
});
