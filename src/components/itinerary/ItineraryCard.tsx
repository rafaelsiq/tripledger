import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatItemSchedule, itemKind } from '@/src/lib/itineraryStory';
import { countVotes } from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';
import { ITINERARY_ITEM_KIND_LABELS } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type Props = {
  item: ItineraryItem;
  onPress: () => void;
};

export function ItineraryCard({ item, onPress }: Props) {
  const counts = useMemo(() => countVotes(item), [item]);
  const schedule = formatItemSchedule(item);
  const kind = itemKind(item);
  const isRest = kind === 'rest';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isRest && styles.cardRest,
        item.done && styles.done,
        pressed && { opacity: 0.94 },
      ]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback, isRest && styles.imageFallbackRest]}>
          <Text style={styles.fallbackText}>{item.title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={[styles.kindTag, isRest && styles.kindTagRest]}>
            {ITINERARY_ITEM_KIND_LABELS[kind]}
          </Text>
          {schedule ? <Text style={styles.time}>{schedule}</Text> : null}
          {item.location ? <Text style={styles.location}>{item.location}</Text> : null}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.voteSummary}>
            {counts.total === 0
              ? 'Toque para votar com o grupo'
              : `${counts.yes} topa · ${counts.maybe} talvez · ${counts.no} não`}
          </Text>
          {item.done ? <Text style={styles.doneTag}>Feito</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardRest: {
    borderColor: '#D7E3EC',
  },
  done: {
    opacity: 0.78,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  imageFallback: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackRest: {
    backgroundColor: colors.financeSoft,
  },
  fallbackText: {
    color: colors.accent,
    fontSize: 48,
    fontFamily: fonts.displayBold,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  kindTag: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kindTagRest: {
    color: colors.finance,
  },
  time: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  location: {
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.3,
  },
  desc: {
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  voteSummary: {
    color: colors.inkMuted,
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    flex: 1,
  },
  doneTag: {
    color: colors.accentDark,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
