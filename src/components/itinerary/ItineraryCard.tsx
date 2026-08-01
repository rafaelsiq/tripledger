import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

type Props = {
  item: ItineraryItem;
  onToggleDone: () => void;
  onToggleRsvp: () => void;
  attending: boolean;
};

export function ItineraryCard({ item, onToggleDone, onToggleRsvp, attending }: Props) {
  return (
    <View style={[styles.card, item.done && styles.done]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Text style={styles.fallbackText}>{item.title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.meta}>
          {item.time ? <Text style={styles.time}>{item.time}</Text> : null}
          {item.location ? <Text style={styles.location}>{item.location}</Text> : null}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={onToggleDone} style={[styles.chip, item.done && styles.chipOn]}>
            <Text style={[styles.chipText, item.done && styles.chipTextOn]}>
              {item.done ? 'Feito' : 'Marcar feito'}
            </Text>
          </Pressable>
          <Pressable onPress={onToggleRsvp} style={[styles.chip, attending && styles.chipOn]}>
            <Text style={[styles.chipText, attending && styles.chipTextOn]}>
              {attending ? 'Vou' : 'Quem vai'} · {item.attendees.length}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
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
  done: {
    opacity: 0.78,
  },
  image: {
    width: '100%',
    height: 180,
  },
  imageFallback: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontFamily: fonts.uiSemi,
  },
  chipTextOn: {
    color: colors.accentDark,
  },
});
