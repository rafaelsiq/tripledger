import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Card, EmptyState, Label, Screen } from '@/src/components/ui';
import { ItineraryCard } from '@/src/components/itinerary/ItineraryCard';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function ItineraryCalendarScreen() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  useEffect(() => {
    if (!days.length || seededRef.current) return;
    seededRef.current = true;
    setMonth(startOfMonth(parseISO(days[0]!.date)));
    setSelectedDate(days[0]!.date);
  }, [days]);

  const dayByDate = useMemo(() => {
    const map = new Map<string, ItineraryDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const selectedDay = selectedDate ? dayByDate.get(selectedDate) : undefined;

  useEffect(() => {
    if (!trip || !selectedDay) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    return subscribeDayItems(trip.id, selectedDay.id, (next) => {
      setItems(next);
      setLoadingItems(false);
    });
  }, [trip, selectedDay?.id]);

  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  if (!trip) return null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        <View style={styles.monthHeader}>
          <Pressable
            onPress={() => setMonth((m) => subMonths(m, 1))}
            hitSlop={10}
            style={({ pressed }) => [styles.monthNav, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Mês anterior"
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {format(month, 'MMMM yyyy', { locale: ptBR })}
          </Text>
          <Pressable
            onPress={() => setMonth((m) => addMonths(m, 1))}
            hitSlop={10}
            style={({ pressed }) => [styles.monthNav, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <Card style={styles.calendarCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date) => {
              const key = format(date, 'yyyy-MM-dd');
              const inMonth = isSameMonth(date, month);
              const tripDay = dayByDate.get(key);
              const selected = selectedDate === key;
              const today = isSameDay(date, new Date());

              return (
                <Pressable
                  key={key}
                  disabled={!tripDay}
                  onPress={() => {
                    if (!tripDay) return;
                    setSelectedDate(key);
                  }}
                  style={({ pressed }) => [
                    styles.cell,
                    !inMonth && styles.cellOutside,
                    tripDay && styles.cellTrip,
                    selected && styles.cellSelected,
                    pressed && tripDay && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      !inMonth && styles.cellTextMuted,
                      tripDay && styles.cellTextTrip,
                      selected && styles.cellTextSelected,
                      today && !selected && styles.cellTextToday,
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                  {tripDay ? <View style={[styles.dot, selected && styles.dotSelected]} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Body muted>
            Dias marcados fazem parte do roteiro. Toque para ver a programação.
          </Body>
        </Card>

        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Label>
              {selectedDay
                ? format(parseISO(selectedDay.date), "EEEE, d 'de' MMMM", { locale: ptBR })
                : 'Selecione um dia'}
            </Label>
            {selectedDay?.title ? (
              <Text style={styles.detailTitle}>{selectedDay.title}</Text>
            ) : null}
          </View>
          {selectedDay ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: `/(app)/trip/${trip.id}/itinerary/day/[dayId]` as never,
                  params: { dayId: selectedDay.id },
                })
              }
              hitSlop={8}
              style={({ pressed }) => [styles.openDay, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.openDayText}>Abrir dia</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.accentDark} />
            </Pressable>
          ) : null}
        </View>

        {loadingItems ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />
        ) : !selectedDay ? (
          <EmptyState title="Nenhum dia selecionado" subtitle="Escolha um dia do roteiro no calendário." />
        ) : items.length === 0 ? (
          <EmptyState title="Dia livre" subtitle="Ainda não há atividades neste dia." />
        ) : (
          <View style={styles.items}>
            {items.map((item) => (
              <ItineraryCard
                key={item.id}
                item={item}
                onPress={() =>
                  router.push({
                    pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                    params: { dayId: selectedDay.id, itemId: item.id },
                  })
                }
              />
            ))}
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNav: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  calendarCard: {
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.uiSemi,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    gap: 3,
  },
  cellOutside: {
    opacity: 0.35,
  },
  cellTrip: {
    backgroundColor: colors.accentSoft,
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellText: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.inkSoft,
  },
  cellTextMuted: {
    color: colors.inkMuted,
  },
  cellTextTrip: {
    color: colors.accentDark,
    fontFamily: fonts.uiBold,
  },
  cellTextSelected: {
    color: colors.white,
  },
  cellTextToday: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  dotSelected: {
    backgroundColor: colors.white,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  detailTitle: {
    marginTop: 4,
    fontFamily: fonts.ui,
    color: colors.inkSoft,
    textTransform: 'capitalize',
  },
  openDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
  },
  openDayText: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentDark,
  },
  items: {
    gap: spacing.sm,
  },
});
