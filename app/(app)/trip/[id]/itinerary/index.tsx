import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { EmptyState, PageHeader, Screen } from '@/src/components/ui';
import { ItineraryCard } from '@/src/components/itinerary/ItineraryCard';
import { ItineraryViewSwitcher } from '@/src/components/itinerary/ItineraryViewSwitcher';
import { todayValue } from '@/src/lib/dates';
import { sortItemsByTime } from '@/src/lib/itineraryStory';
import { subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

/** Weekday + day-of-month chip in the horizontal day strip. */
function DayChip({
  date,
  selected,
  today,
  onPress,
}: {
  date: string;
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
      accessibilityLabel={format(parsed, "EEEE, d 'de' MMMM", { locale: ptBR })}
      style={[styles.chip, today && !selected && styles.chipToday, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipWeekday, selected && styles.chipTextSelected]}>
        {format(parsed, 'EEE', { locale: ptBR }).replace('.', '').toUpperCase()}
      </Text>
      <Text style={[styles.chipDay, selected && styles.chipTextSelected]}>{format(parsed, 'd')}</Text>
    </Pressable>
  );
}

export default function ItineraryHome() {
  const { trip, isAdmin, isFinanceLead, canMutate } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
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

  useEffect(() => {
    if (!trip || !selectedId) return;
    setItems([]);
    return subscribeDayItems(trip.id, selectedId, setItems);
  }, [trip, selectedId]);

  const sortedItems = useMemo(() => sortItemsByTime(items), [items]);

  if (!trip) return null;

  const dayIndex = days.findIndex((d) => d.id === selectedId);
  const selectedDay = dayIndex >= 0 ? days[dayIndex] : null;
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
      pathname: `/(app)/trip/${trip!.id}/itinerary/new-item` as never,
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
          <EmptyState title="Sem dias" subtitle="Defina as datas da viagem para gerar a agenda." />
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

            {sortedItems.length === 0 ? (
              <EmptyState
                title="Dia livre"
                subtitle={
                  canMutate
                    ? 'Toque em Atividade para montar o dia.'
                    : 'Ainda não há atividades neste dia.'
                }
              />
            ) : (
              <View>
                {sortedItems.map((item, index) => (
                  <ItineraryCard
                    key={item.id}
                    item={item}
                    isLast={index === sortedItems.length - 1}
                    onPress={() =>
                      router.push({
                        pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                        params: { itemId: item.id, dayId: item.dayId },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {canMutate && selectedDay ? (
        <Pressable
          onPress={newActivity}
          accessibilityRole="button"
          accessibilityLabel="Nova atividade neste dia"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.fabText}>Atividade</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: 120 },
  strip: { gap: 6 },
  chip: {
    width: 48,
    paddingVertical: 7,
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
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.raised,
  },
  fabText: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.white },
});
