import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { StoryActivityChip } from '@/src/components/itinerary/StoryActivityChip';
import { StoryDayBridge } from '@/src/components/itinerary/StoryDayBridge';
import { StoryRailNav, storyHeroStyles } from '@/src/components/itinerary/StoryRailNav';
import { Body, EmptyState, Screen } from '@/src/components/ui';
import { useLayout } from '@/src/hooks/useLayout';
import { useTrip } from '@/src/hooks/useTrip';
import { pickMainActivities } from '@/src/lib/itineraryStory';
import {
  subscribeItineraryDays,
  subscribeTripItineraryItems,
} from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

const CARD_WIDTH = 280;
const BRIDGE_WIDTH = 72;

export default function StorytellingOverviewScreen() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const { isWide } = useLayout();
  const router = useRouter();
  const railRef = useRef<ScrollView>(null);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [itemsByDay, setItemsByDay] = useState<Record<string, ItineraryItem[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = isWide ? 300 : CARD_WIDTH;
  const step = cardWidth + BRIDGE_WIDTH;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < Math.max(0, days.length - 1);

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

  function scrollToDay(index: number) {
    const next = Math.max(0, Math.min(days.length - 1, index));
    setActiveIndex(next);
    railRef.current?.scrollTo({
      x: next * step,
      animated: true,
    });
  }

  if (!trip) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Storytelling' }} />

      <View style={storyHeroStyles.hero}>
        <Text style={storyHeroStyles.title}>Storytelling</Text>
        <Body muted>
          A viagem em sequência — o fim de um dia se liga ao amanhecer do
          próximo.
        </Body>
      </View>

      <View style={storyHeroStyles.bannerSlot}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      </View>

      {!days.length ? (
        <EmptyState
          title="Sem dias"
          subtitle="Defina as datas da viagem para gerar a agenda."
        />
      ) : (
        <StoryRailNav
          railRef={railRef}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={() => scrollToDay(activeIndex - 1)}
          onNext={() => scrollToDay(activeIndex + 1)}
          prevAccessibilityLabel="Dia anterior"
          nextAccessibilityLabel="Próximo dia"
          positionHint={`Dia ${activeIndex + 1} de ${days.length}`}
          snapToInterval={step}
          railStyle={styles.rail}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const next = Math.round(x / step);
            if (next !== activeIndex) {
              setActiveIndex(Math.max(0, Math.min(days.length - 1, next)));
            }
          }}
        >
          {days.map((item, index) => {
            const items = itemsByDay[item.id] || [];
            const highlights = pickMainActivities(items, 3);
            const nextDay = days[index + 1];
            return (
              <React.Fragment key={item.id}>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(app)/trip/${trip.id}/itinerary/storytelling/${item.id}`
                    )
                  }
                  style={({ pressed }) => [
                    styles.chapter,
                    { width: cardWidth },
                    pressed && { opacity: 0.94 },
                  ]}
                >
                  <View style={styles.chapterHeader}>
                    <Text style={storyHeroStyles.eyebrow}>Dia {index + 1}</Text>
                    <Text style={styles.dayTitle} numberOfLines={2}>
                      {item.title || `Dia ${index + 1}`}
                    </Text>
                    <Text style={storyHeroStyles.date}>
                      {format(parseISO(item.date), "EEEE, d 'de' MMMM", {
                        locale: ptBR,
                      })}
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
                              pathname:
                                `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
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

                {nextDay ? (
                  <StoryDayBridge
                    fromLabel={`Dia ${index + 1}`}
                    toLabel={`Dia ${index + 2}`}
                    onPress={() => scrollToDay(index + 1)}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </StoryRailNav>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rail: {
    maxHeight: 440,
  },
  chapter: {
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    minHeight: 340,
    ...shadows.card,
  },
  chapterHeader: { gap: 4 },
  dayTitle: {
    color: colors.ink,
    fontSize: 24,
    fontFamily: fonts.display,
  },
  highlights: { gap: spacing.sm, flexGrow: 1 },
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
    marginTop: spacing.sm,
  },
});
