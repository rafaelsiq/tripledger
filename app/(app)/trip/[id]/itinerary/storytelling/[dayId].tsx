import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { StoryDayBridge } from '@/src/components/itinerary/StoryDayBridge';
import { StoryHourColumn } from '@/src/components/itinerary/StoryHourColumn';
import { StoryRailNav, storyHeroStyles } from '@/src/components/itinerary/StoryRailNav';
import { StoryTimelineRow } from '@/src/components/itinerary/StoryTimelineRow';
import { Body, Screen } from '@/src/components/ui';
import { useLayout } from '@/src/hooks/useLayout';
import { useTrip } from '@/src/hooks/useTrip';
import { buildHourSlots } from '@/src/lib/itineraryStory';
import { subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

const BRIDGE_WIDE = 72;
const BRIDGE_NARROW = 52;

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
  const hourWidth = isWide ? 180 : 128;
  const hourGap = isWide ? spacing.md : spacing.sm;
  const hourStep = hourWidth + hourGap;
  const untimedCardWidth = isWide ? 240 : 200;
  const pageHours = isWide ? 3 : 2;
  const bridgeWidth = isWide ? BRIDGE_WIDE : BRIDGE_NARROW;

  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : undefined;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : undefined;
  const bridgeOffset = prevDay ? bridgeWidth : 0;

  const canGoPrev = activeHour > 0;
  const canGoNext = activeHour < Math.max(0, hours.length - 1);

  useEffect(() => {
    setActiveHour(0);
    railRef.current?.scrollTo({ x: 0, animated: false });
  }, [dayId]);

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

  function scrollToHour(index: number) {
    const next = Math.max(0, Math.min(hours.length - 1, index));
    setActiveHour(next);
    railRef.current?.scrollTo({
      x: bridgeOffset + next * hourStep,
      animated: true,
    });
  }

  function scrollByPage(direction: -1 | 1) {
    scrollToHour(activeHour + direction * pageHours);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Timeline do dia' }} />

      <View style={styles.content}>
        <View style={storyHeroStyles.hero}>
          {dayIndex >= 0 ? (
            <Text style={storyHeroStyles.eyebrow}>Dia {dayIndex + 1}</Text>
          ) : null}
          <Text style={[storyHeroStyles.title, !isWide && storyHeroStyles.titleCompact]}>
            {title}
          </Text>
          {day ? (
            <Text style={storyHeroStyles.date}>
              {format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>
          ) : null}
          <Body muted>
            A sequência do dia — o fim se liga ao amanhecer do próximo.
          </Body>
        </View>

        <View style={storyHeroStyles.bannerSlot}>
          <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        </View>

        <StoryRailNav
          railRef={railRef}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={() => scrollByPage(-1)}
          onNext={() => scrollByPage(1)}
          prevAccessibilityLabel="Horários anteriores"
          nextAccessibilityLabel="Próximos horários"
          positionHint={`Hora ${activeHour + 1} de ${hours.length}`}
          snapToInterval={hourStep}
          railStyle={[styles.rail, !isWide && styles.railMobile]}
          contentContainerStyle={styles.trackPad}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const next = Math.round(Math.max(0, x - bridgeOffset) / hourStep);
            if (next !== activeHour) {
              setActiveHour(Math.max(0, Math.min(hours.length - 1, next)));
            }
          }}
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
        </StoryRailNav>

        {untimed.length ? (
          <View style={styles.untimed}>
            <Text style={styles.untimedEyebrow}>Sem horário</Text>
            <Body muted>Atividades ainda sem horário definido.</Body>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.untimedTrack}
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
  rail: {
    maxHeight: 320,
  },
  railMobile: {
    maxHeight: 280,
  },
  trackPad: {
    paddingRight: spacing.lg,
  },
  untimed: {
    gap: spacing.sm,
  },
  untimedEyebrow: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  untimedTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.sm,
  },
});
