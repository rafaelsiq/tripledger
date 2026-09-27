import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { StoryDayBridge } from '@/src/components/itinerary/StoryDayBridge';
import { StoryHourColumn } from '@/src/components/itinerary/StoryHourColumn';
import { StoryTimelineRow } from '@/src/components/itinerary/StoryTimelineRow';
import { Body, Label, Screen } from '@/src/components/ui';
import { useLayout } from '@/src/hooks/useLayout';
import { useTrip } from '@/src/hooks/useTrip';
import { buildHourSlots } from '@/src/lib/itineraryStory';
import { subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

export default function StorytellingDayScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { isWide } = useLayout();
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

  const { hours, untimed } = useMemo(() => buildHourSlots(items), [items]);
  const hourWidth = isWide ? 180 : 150;
  const untimedCardWidth = isWide ? 240 : 200;

  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : undefined;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : undefined;

  if (!trip) return null;

  const title = day?.title || (dayIndex >= 0 ? `Dia ${dayIndex + 1}` : 'Dia');

  function openItem(item: ItineraryItem) {
    router.push({
      pathname: `/(app)/trip/${trip!.id}/itinerary/item/[itemId]` as never,
      params: { itemId: item.id, dayId: String(dayId) },
    });
  }

  function addAtTime(timeLabel: string) {
    if (!canMutate) return;
    router.push({
      pathname: `/(app)/trip/${trip!.id}/itinerary/new-item` as never,
      params: {
        dayId: String(dayId),
        order: String(items.length),
        time: timeLabel,
      },
    });
  }

  function openDay(targetId: string) {
    router.replace(`/(app)/trip/${trip!.id}/itinerary/storytelling/${targetId}`);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Timeline do dia' }} />

      <View style={styles.content}>
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
          <Body muted>
            Do amanhecer à noite — e a sequência segue no dia seguinte.
          </Body>
        </View>

        <View style={styles.block}>
          <Label>Horários do dia</Label>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            style={styles.rail}
            contentContainerStyle={styles.track}
          >
            {prevDay ? (
              <StoryDayBridge
                compact
                fromLabel={`Dia ${dayIndex}`}
                toLabel={`Dia ${dayIndex + 1}`}
                onPress={() => openDay(prevDay.id)}
              />
            ) : null}

            {hours.map((slot, index) => (
              <StoryHourColumn
                key={slot.label}
                timeLabel={slot.label}
                items={slot.items}
                canAdd={canMutate}
                width={hourWidth}
                isLast={index === hours.length - 1 && !nextDay}
                onAdd={() => addAtTime(slot.label)}
                onOpenItem={openItem}
              />
            ))}

            {nextDay ? (
              <StoryDayBridge
                compact
                fromLabel={`Dia ${dayIndex + 1}`}
                toLabel={`Dia ${dayIndex + 2}`}
                onPress={() => openDay(nextDay.id)}
              />
            ) : null}
          </ScrollView>
        </View>

        {untimed.length ? (
          <View style={styles.block}>
            <Label>Sem horário</Label>
            <Body muted>Atividades ainda sem horário definido.</Body>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              style={styles.rail}
              contentContainerStyle={styles.track}
            >
              {untimed.map((item, index) => (
                <StoryTimelineRow
                  key={item.id}
                  item={item}
                  timeLabel="—"
                  cardWidth={untimedCardWidth}
                  isLast={index === untimed.length - 1}
                  onPress={() => openItem(item)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.md,
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
  block: { gap: spacing.sm },
  rail: {
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'hidden',
        } as object)
      : null),
  },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
  },
});
