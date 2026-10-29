import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatItemSchedule, itemKind } from '@/src/lib/itineraryStory';
import { countVotes } from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  item: ItineraryItem;
  onPress: () => void;
  /** Hides the timeline connector below the last item of a day. */
  isLast?: boolean;
};

/** One timeline entry: time column + activity card (rest blocks render as dashed). */
export function ItineraryCard({ item, onPress, isLast }: Props) {
  const counts = useMemo(() => countVotes(item), [item]);
  const schedule = formatItemSchedule(item);
  const isRest = itemKind(item) === 'rest';

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{item.time?.trim() || '—'}</Text>
        {!isLast ? <View style={styles.line} /> : null}
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          isRest && styles.cardRest,
          item.done && styles.done,
          pressed && { opacity: 0.92 },
        ]}
      >
        {item.imageUrl && !isRest ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : null}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            {item.done ? (
              <View style={styles.doneDot}>
                <Ionicons name="checkmark" size={12} color={colors.white} />
              </View>
            ) : null}
            <Text style={[styles.title, item.done && styles.titleDone]} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          {schedule || item.location ? (
            <Text style={styles.meta} numberOfLines={1}>
              {[schedule, item.location].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.description && !isRest ? (
            <Text style={styles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          {!isRest ? (
            <Text style={styles.votes}>
              {counts.total === 0 ? (
                <Text style={styles.votesCta}>Toque para votar com o grupo</Text>
              ) : (
                <>
                  <Text style={styles.votesYes}>{counts.yes} topam</Text>
                  {` · ${counts.maybe} talvez · ${counts.no} não`}
                </>
              )}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  timeCol: { width: 46, alignItems: 'center', paddingTop: 12 },
  time: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 6 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRest: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  done: { opacity: 0.7 },
  image: { width: '100%', height: 110 },
  body: { paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: colors.ink, fontSize: 16, fontFamily: fonts.uiBold },
  titleDone: { textDecorationLine: 'line-through', color: colors.inkSoft },
  meta: { color: colors.inkSoft, fontFamily: fonts.ui, fontSize: 13 },
  desc: { color: colors.inkSoft, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  votes: { marginTop: 4, color: colors.inkSoft, fontFamily: fonts.ui, fontSize: 13 },
  votesYes: { color: colors.success, fontFamily: fonts.uiBold },
  votesCta: { color: colors.warn, fontFamily: fonts.uiSemi },
});
