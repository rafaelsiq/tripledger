import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { StoryActivityChip } from '@/src/components/itinerary/StoryActivityChip';
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
const CARD_GAP = spacing.md;

export default function StorytellingOverviewScreen() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const { isWide } = useLayout();
  const router = useRouter();
  const railRef = useRef<ScrollView>(null);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [itemsByDay, setItemsByDay] = useState<Record<string, ItineraryItem[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = isWide ? 300 : CARD_WIDTH;

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
      x: next * (cardWidth + CARD_GAP),
      animated: true,
    });
  }

  if (!trip) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Storytelling' }} />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Storytelling</Text>
        <Body muted>
          Dias lado a lado — deslize na horizontal e toque para abrir a timeline.
        </Body>
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      </View>

      {!days.length ? (
        <EmptyState
          title="Sem dias"
          subtitle="Defina as datas da viagem para gerar a agenda."
        />
      ) : (
        <View style={styles.railWrap}>
          <ScrollView
            ref={railRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            decelerationRate="fast"
            snapToInterval={cardWidth + CARD_GAP}
            snapToAlignment="start"
            disableIntervalMomentum
            style={styles.rail}
            contentContainerStyle={styles.railContent}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const next = Math.round(x / (cardWidth + CARD_GAP));
              if (next !== activeIndex) {
                setActiveIndex(Math.max(0, Math.min(days.length - 1, next)));
              }
            }}
            scrollEventThrottle={16}
          >
            {days.map((item, index) => {
              const items = itemsByDay[item.id] || [];
              const highlights = pickMainActivities(items, 3);
              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push(
                      `/(app)/trip/${trip.id}/itinerary/storytelling/${item.id}`
                    )
                  }
                  style={({ pressed }) => [
                    styles.chapter,
                    {
                      width: cardWidth,
                      marginRight: index === days.length - 1 ? 0 : CARD_GAP,
                    },
                    pressed && { opacity: 0.94 },
                  ]}
                >
                  <View style={styles.chapterHeader}>
                    <Text style={styles.dayIndex}>Dia {index + 1}</Text>
                    <Text style={styles.dayTitle} numberOfLines={2}>
                      {item.title || `Dia ${index + 1}`}
                    </Text>
                    <Text style={styles.dayDate}>
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
              );
            })}
          </ScrollView>

          <View style={styles.dots}>
            {days.map((day, index) => (
              <Pressable
                key={day.id}
                onPress={() => scrollToDay(index)}
                style={[styles.dot, index === activeIndex && styles.dotOn]}
                accessibilityLabel={`Ir para dia ${index + 1}`}
              />
            ))}
          </View>
        </View>
      )}
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
  railWrap: {
    gap: spacing.sm,
    width: '100%',
  },
  rail: {
    width: '100%',
    maxHeight: 440,
    ...(Platform.OS === 'web'
      ? ({
          // Ensure the scroller itself never stacks children vertically on web.
          overflowX: 'auto',
          overflowY: 'hidden',
        } as object)
      : null),
  },
  railContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotOn: {
    backgroundColor: colors.accent,
    width: 18,
  },
});
