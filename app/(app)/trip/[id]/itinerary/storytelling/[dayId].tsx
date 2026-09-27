import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { StoryTimelineRow } from '@/src/components/itinerary/StoryTimelineRow';
import { Body, EmptyState, Label, Screen } from '@/src/components/ui';
import { useTrip } from '@/src/hooks/useTrip';
import { parseItemTime, splitTimedAndUntimed } from '@/src/lib/itineraryStory';
import { subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

export default function StorytellingDayScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  useEffect(() => {
    if (!trip || !dayId) return;
    return subscribeDayItems(trip.id, String(dayId), setItems);
  }, [trip, dayId]);

  const day = useMemo(
    () => days.find((d) => d.id === String(dayId)),
    [days, dayId]
  );
  const dayIndex = useMemo(
    () => days.findIndex((d) => d.id === String(dayId)),
    [days, dayId]
  );

  const { timed, untimed } = useMemo(() => splitTimedAndUntimed(items), [items]);

  if (!trip) return null;

  const title = day?.title || (dayIndex >= 0 ? `Dia ${dayIndex + 1}` : 'Dia');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Timeline do dia' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        <View style={styles.hero}>
          {dayIndex >= 0 ? (
            <Text style={styles.dayIndex}>Dia {dayIndex + 1}</Text>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {day ? (
            <Text style={styles.date}>
              {format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>
          ) : null}
          <Body muted>Atividades ordenadas do início ao fim do dia (00:00–23:59).</Body>
        </View>

        {!items.length ? (
          <EmptyState
            title="Dia livre"
            subtitle="Ainda não há atividades neste dia."
          />
        ) : (
          <View style={styles.timeline}>
            {timed.length ? (
              <View style={styles.block}>
                <Label>Ao longo do dia</Label>
                {timed.map((item, index) => {
                  const minutes = parseItemTime(item.time);
                  const timeLabel =
                    item.time?.trim() ||
                    (minutes !== null
                      ? `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
                      : '--:--');
                  return (
                    <StoryTimelineRow
                      key={item.id}
                      item={item}
                      timeLabel={timeLabel}
                      isLast={index === timed.length - 1 && untimed.length === 0}
                      onPress={() =>
                        router.push({
                          pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                          params: { itemId: item.id, dayId: String(dayId) },
                        })
                      }
                    />
                  );
                })}
              </View>
            ) : null}

            {untimed.length ? (
              <View style={styles.block}>
                <Label>Sem horário</Label>
                <Body muted>Atividades sem horário definido ficam ao final da timeline.</Body>
                {untimed.map((item, index) => (
                  <StoryTimelineRow
                    key={item.id}
                    item={item}
                    timeLabel="—"
                    isLast={index === untimed.length - 1}
                    onPress={() =>
                      router.push({
                        pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                        params: { itemId: item.id, dayId: String(dayId) },
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  hero: { gap: spacing.xs },
  dayIndex: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.5,
  },
  date: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  timeline: { gap: spacing.lg },
  block: { gap: spacing.sm },
});
