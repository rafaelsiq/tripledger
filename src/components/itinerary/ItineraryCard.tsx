import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItineraryItem } from '@/src/types';
import { colors, radii, spacing } from '@/src/theme';

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
          <Pressable onPress={onToggleDone} style={styles.chip}>
            <Text style={styles.chipText}>{item.done ? 'Feito' : 'Marcar feito'}</Text>
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
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  done: {
    opacity: 0.72,
  },
  image: {
    width: '100%',
    height: 180,
  },
  imageFallback: {
    backgroundColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.itineraryAccent,
    fontSize: 48,
    fontWeight: '700',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  time: {
    color: colors.itineraryAccent,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  location: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  desc: {
    color: 'rgba(255,255,255,0.75)',
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
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: {
    backgroundColor: colors.itineraryAccent,
    borderColor: colors.itineraryAccent,
  },
  chipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextOn: {
    color: colors.white,
  },
});
