import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { StoryActivityChip } from '@/src/components/itinerary/StoryActivityChip';
import { Body, EmptyState, Screen } from '@/src/components/ui';
import { useTrip } from '@/src/hooks/useTrip';
import { pickMainActivities } from '@/src/lib/itineraryStory';
import {
  subscribeItineraryDays,
  subscribeTripItineraryItems,
} from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

export default function StorytellingOverviewScreen() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [itemsByDay, setItemsByDay] = useState<Record<string, ItineraryItem[]>>({});

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  const dayIds = useMemo(() => days.map((d) => d.id), [days]);

  useEffect(() => {
    if (!trip || !dayIds.length) {
      setItemsByDay({});
      return;
    }
    return subscribeTripItineraryItems(trip.id, dayIds, setItemsByDay);
  }, [trip, dayIds.join('|')]);

  if (!trip) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Storytelling' }} />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Storytelling</Text>
        <Body muted>A viagem em capítulos — toque em um dia para ver a timeline.</Body>
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      </View>

      <FlatList
        style={styles.list}
        data={days}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="Sem dias"
            subtitle="Defina as datas da viagem para gerar a agenda."
          />
        }
        renderItem={({ item, index }) => {
          const items = itemsByDay[item.id] || [];
          const highlights = pickMainActivities(items, 3);
          return (
            <Pressable
              onPress={() =>
                router.push(
                  `/(app)/trip/${trip.id}/itinerary/storytelling/${item.id}`
                )
              }
              style={({ pressed }) => [styles.chapter, pressed && { opacity: 0.94 }]}
            >
              <View style={styles.chapterHeader}>
                <Text style={styles.dayIndex}>Dia {index + 1}</Text>
                <Text style={styles.dayTitle}>{item.title || `Dia ${index + 1}`}</Text>
                <Text style={styles.dayDate}>
                  {format(parseISO(item.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </Text>
              </View>

              {highlights.length ? (
                <View style={styles.highlights}>
                  {highlights.map((activity) => (
                    <StoryActivityChip
                      key={activity.id}
                      item={activity}
                      onPress={() =>
                        router.push({
                          pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                          params: { itemId: activity.id, dayId: item.id },
                        })
                      }
                    />
                  ))}
                  {items.length > highlights.length ? (
                    <Text style={styles.more}>
                      +{items.length - highlights.length} atividade
                      {items.length - highlights.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.emptyDay}>Sem atividades neste dia</Text>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 32,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.6,
  },
  list: { flex: 1 },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  chapter: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  chapterHeader: { gap: 4 },
  dayIndex: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  dayTitle: {
    color: colors.ink,
    fontSize: 24,
    fontFamily: fonts.display,
  },
  dayDate: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    textTransform: 'capitalize',
  },
  highlights: { gap: spacing.sm },
  more: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    color: colors.inkSoft,
    paddingLeft: 2,
  },
  emptyDay: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkMuted,
  },
});
