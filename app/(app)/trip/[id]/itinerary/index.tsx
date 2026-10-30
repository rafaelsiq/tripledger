import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState, PageHeader, Screen } from '@/src/components/ui';
import { ItineraryAddFab } from '@/src/components/itinerary/ItineraryAddFab';
import { ItineraryDayTimeline } from '@/src/components/itinerary/ItineraryDayTimeline';
import { ItineraryViewSwitcher } from '@/src/components/itinerary/ItineraryViewSwitcher';
import { todayValue } from '@/src/lib/dates';
import { subscribeItineraryDays, subscribeTripItineraryItems } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

const MAX_DOTS = 3;

/** Weekday + day-of-month chip in the horizontal day strip, with one dot per planned item. */
function DayChip({
  date,
  itemCount,
  selected,
  today,
  onPress,
}: {
  date: string;
  itemCount: number;
  selected: boolean;
  today: boolean;
  onPress: () => void;
}) {
  const parsed = parseISO(date);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${format(parsed, "EEEE, d 'de' MMMM", { locale: ptBR })}, ${
        itemCount === 0 ? 'dia livre' : `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`
      }`}
      style={[styles.chip, today && !selected && styles.chipToday, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipWeekday, selected && styles.chipTextSelected]}>
        {/* ptBR "EEE" can come back as the full name ("domingo"); the chip only fits 3 letters. */}
        {format(parsed, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3).toUpperCase()}
      </Text>
      <Text style={[styles.chipDay, selected && styles.chipTextSelected]}>{format(parsed, 'd')}</Text>
      <View style={styles.dots}>
        {itemCount === 0 ? (
          <View style={[styles.dot, styles.dotEmpty, selected && styles.dotEmptySelected]} />
        ) : itemCount > MAX_DOTS ? (
          <Text style={[styles.dotCount, selected && styles.chipTextSelected]}>{itemCount}</Text>
        ) : (
          Array.from({ length: itemCount }, (_, i) => (
            <View key={i} style={[styles.dot, selected && styles.dotSelected]} />
          ))
        )}
      </View>
    </Pressable>
  );
}

export default function ItineraryHome() {
  const { trip, isAdmin, isFinanceLead, canMutate } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemsByDay, setItemsByDay] = useState<Record<string, ItineraryItem[]>>({});
  const today = todayValue();

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  // Default to today's day when the trip is happening, otherwise the first day.
  useEffect(() => {
    if (!days.length) return;
    if (selectedId && days.some((d) => d.id === selectedId)) return;
    setSelectedId((days.find((d) => d.date === today) ?? days[0]).id);
  }, [days, selectedId, today]);

  // Every day's items, so each chip can preview how planned the day is.
  const dayIdsKey = useMemo(() => days.map((d) => d.id).join('|'), [days]);
  useEffect(() => {
    if (!trip) return;
    return subscribeTripItineraryItems(trip.id, dayIdsKey ? dayIdsKey.split('|') : [], setItemsByDay);
  }, [trip, dayIdsKey]);

  if (!trip) return null;

  const dayIndex = days.findIndex((d) => d.id === selectedId);
  const selectedDay = dayIndex >= 0 ? days[dayIndex] : null;
  const items = (selectedId && itemsByDay[selectedId]) || [];
  const isToday = selectedDay?.date === today;

  function openDay() {
    if (!selectedDay) return;
    router.push({
      pathname: `/(app)/trip/${trip!.id}/itinerary/day/[dayId]` as never,
      params: { dayId: selectedDay.id },
    });
  }

  function newActivity() {
    if (!selectedDay) return;
    router.push({
      pathname: `/(app)/trip/${trip!.id}/itinerary/add` as never,
      params: { dayId: selectedDay.id, order: String(items.length) },
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          title="Roteiro"
          subtitle={
            days.length > 0
              ? `${days.length} ${days.length === 1 ? 'dia' : 'dias'} de programação`
              : undefined
          }
        />
        <ItineraryViewSwitcher tripId={trip.id} current="list" />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        {days.length === 0 ? (
          <EmptyState
            title="Roteiro ainda sem dias"
            subtitle="Os dias são gerados a partir das datas de início e fim da viagem."
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {days.map((d) => (
                <DayChip
                  key={d.id}
                  date={d.date}
                  itemCount={itemsByDay[d.id]?.length ?? 0}
                  selected={d.id === selectedId}
                  today={d.date === today}
                  onPress={() => setSelectedId(d.id)}
                />
              ))}
            </ScrollView>

            {selectedDay ? (
              <View style={styles.dayHead}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.eyebrow}>
                    Dia {dayIndex + 1}
                    {isToday ? ' · hoje' : ''}
                  </Text>
                  <Text style={styles.dayTitle}>{selectedDay.title || 'Programação'}</Text>
                  <Text style={styles.dayDate}>
                    {format(parseISO(selectedDay.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </Text>
                </View>
                <Pressable onPress={openDay} hitSlop={8} accessibilityRole="button" style={styles.openDay}>
                  <Text style={styles.openDayText}>Abrir dia</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                </Pressable>
              </View>
            ) : null}

            {items.length === 0 ? (
              <View style={styles.empty}>
                <EmptyState
                  title="Dia livre"
                  subtitle={
                    canMutate
                      ? 'Nada planejado ainda. Toque para planejar o dia.'
                      : 'Ainda não há atividades neste dia.'
                  }
                />
                {canMutate && selectedDay ? (
                  <Button title="Planejar o dia" icon="add" size="sm" onPress={newActivity} />
                ) : null}
              </View>
            ) : (
              <ItineraryDayTimeline
                items={items}
                onPressItem={(item) =>
                  router.push({
                    pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                    params: { itemId: item.id, dayId: item.dayId },
                  })
                }
              />
            )}
          </>
        )}
      </ScrollView>

      {canMutate && selectedDay ? <ItineraryAddFab onPress={newActivity} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: 120 },
  strip: { gap: 6 },
  chip: {
    width: 48,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  chipToday: { borderColor: colors.accent },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipWeekday: { fontFamily: fonts.uiBold, fontSize: 11, color: colors.inkSoft },
  chipDay: {
    fontFamily: fonts.uiHeavy,
    fontSize: 17,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  chipTextSelected: { color: colors.white },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 12,
    marginTop: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  dotSelected: { backgroundColor: colors.white },
  dotEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
  dotEmptySelected: { borderColor: colors.inkMuted },
  dotCount: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  dayHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  dayTitle: { fontFamily: fonts.uiHeavy, fontSize: 20, color: colors.ink },
  dayDate: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
    textTransform: 'capitalize',
  },
  openDay: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  openDayText: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.accent },
  empty: { alignItems: 'center', gap: spacing.sm },
});
