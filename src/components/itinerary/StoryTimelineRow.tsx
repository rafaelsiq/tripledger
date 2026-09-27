import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type Props = {
  item: ItineraryItem;
  timeLabel: string;
  onPress: () => void;
  isLast?: boolean;
  cardWidth?: number;
};

/** Horizontal timeline card for storytelling day view. */
export function StoryTimelineRow({
  item,
  timeLabel,
  onPress,
  isLast,
  cardWidth = 260,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { width: cardWidth },
          pressed && { opacity: 0.92 },
        ]}
      >
        <Text style={styles.time}>{timeLabel}</Text>
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
            <Text style={styles.desc} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {!isLast ? <View style={styles.connector} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexShrink: 0,
    ...shadows.card,
  },
  time: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.accent,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    letterSpacing: 0.3,
  },
  image: {
    width: '100%',
    height: 150,
    marginTop: spacing.sm,
    backgroundColor: colors.accentSoft,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    color: colors.accent,
  },
  body: {
    gap: 4,
    padding: spacing.md,
  },
  title: {
    fontFamily: fonts.uiBold,
    fontSize: 16,
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
  connector: {
    width: 28,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
});
