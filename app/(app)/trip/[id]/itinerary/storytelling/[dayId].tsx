import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

const BRIDGE_WIDTH = 88;
const HOUR_GAP = spacing.md;
/** Advance roughly one screen of hours per arrow tap. */
const PAGE_HOURS = 3;

export default function StorytellingDayScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { isWide } = useLayout();
  const router = useRouter();
  const railRef = useRef<ScrollView>(null);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [activeHour, setActiveHour] = useState(0);

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
  const hourStep = hourWidth + HOUR_GAP;
  const untimedCardWidth = isWide ? 240 : 200;

  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : undefined;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : undefined;
  const bridgeOffset = prevDay ? BRIDGE_WIDTH : 0;

  const canGoPrev = activeHour > 0;
  const canGoNext = activeHour < Math.max(0, hours.length - 1);

  useEffect(() => {
    setActiveHour(0);
    railRef.current?.scrollTo({ x: 0, animated: false });
  }, [dayId]);

  if (!trip) return null;

  const title = day?.title || (dayIndex >= 0 ? `Dia ${dayIndex + 1}` : 'Dia');
  const activeLabel = hours[activeHour]?.label ?? '00:00';

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

  function scrollToHour(index: number) {
    const next = Math.max(0, Math.min(hours.length - 1, index));
    setActiveHour(next);
    railRef.current?.scrollTo({
      x: bridgeOffset + next * hourStep,
      animated: true,
    });
  }

  function scrollByPage(direction: -1 | 1) {
    scrollToHour(activeHour + direction * PAGE_HOURS);
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
            Do amanhecer à noite — use as setas para percorrer os horários.
          </Body>
        </View>

        <View style={styles.block}>
          <Label>Horários do dia</Label>
          <View style={styles.railWrap}>
            <View style={styles.railRow}>
              <Pressable
                onPress={() => scrollByPage(-1)}
                disabled={!canGoPrev}
                accessibilityRole="button"
                accessibilityLabel="Horários anteriores"
                style={({ pressed }) => [
                  styles.sideBtn,
                  !canGoPrev && styles.sideBtnDisabled,
                  pressed && canGoPrev && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={canGoPrev ? colors.accent : colors.inkMuted}
                />
              </Pressable>

              <ScrollView
                ref={railRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={hourStep}
                snapToAlignment="start"
                disableIntervalMomentum
                style={styles.rail}
                contentContainerStyle={styles.track}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const next = Math.round(Math.max(0, x - bridgeOffset) / hourStep);
                  if (next !== activeHour) {
                    setActiveHour(Math.max(0, Math.min(hours.length - 1, next)));
                  }
                }}
                scrollEventThrottle={16}
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

              <Pressable
                onPress={() => scrollByPage(1)}
                disabled={!canGoNext}
                accessibilityRole="button"
                accessibilityLabel="Próximos horários"
                style={({ pressed }) => [
                  styles.sideBtn,
                  !canGoNext && styles.sideBtnDisabled,
                  pressed && canGoNext && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={canGoNext ? colors.accent : colors.inkMuted}
                />
              </Pressable>
            </View>

            <Text style={styles.positionHint}>
              {activeLabel} · hora {activeHour + 1} de {hours.length}
            </Text>
          </View>
        </View>

        {untimed.length ? (
          <View style={styles.block}>
            <Label>Sem horário</Label>
            <Body muted>Atividades ainda sem horário definido.</Body>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
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
  railWrap: {
    gap: spacing.sm,
    width: '100%',
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#C6E3DB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sideBtnDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  rail: {
    flex: 1,
    maxHeight: 320,
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'hidden',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as object)
      : null),
  },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
  },
  positionHint: {
    textAlign: 'center',
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.inkSoft,
  },
});
