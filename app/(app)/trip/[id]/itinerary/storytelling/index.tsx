import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
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

export default function StorytellingOverviewScreen() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const { width, pagePadding, isWide } = useLayout();
  const router = useRouter();
  const listRef = useRef<FlatList<ItineraryDay>>(null);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [itemsByDay, setItemsByDay] = useState<Record<string, ItineraryItem[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const contentWidth = Math.min(width, 1280);
  const cardGap = spacing.md;
  // Narrow enough that several day cards sit side-by-side in the viewport.
  const cardWidth = isWide
    ? Math.min(300, Math.max(240, Math.floor((contentWidth - pagePadding * 2) / 3) - cardGap))
    : Math.min(280, Math.max(220, width - pagePadding * 2 - 48));

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

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / (cardWidth + cardGap));
    setActiveIndex(Math.max(0, Math.min(days.length - 1, next)));
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
        <>
          <FlatList
            ref={listRef}
            horizontal
            data={days}
            keyExtractor={(item) => item.id}
            style={styles.dayRail}
            showsHorizontalScrollIndicator
            decelerationRate="fast"
            snapToInterval={cardWidth + cardGap}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={styles.listContent}
            onMomentumScrollEnd={onScrollEnd}
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
                  style={({ pressed }) => [
                    styles.chapter,
                    { width: cardWidth, marginRight: cardGap },
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
            }}
          />

          <View style={styles.dots}>
            {days.map((day, index) => (
              <Pressable
                key={day.id}
                onPress={() => {
                  listRef.current?.scrollToOffset({
                    offset: index * (cardWidth + cardGap),
                    animated: true,
                  });
                  setActiveIndex(index);
                }}
                style={[styles.dot, index === activeIndex && styles.dotOn]}
                accessibilityLabel={`Ir para dia ${index + 1}`}
              />
            ))}
          </View>
        </>
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
  listContent: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
    alignItems: 'stretch',
  },
  dayRail: {
    flexGrow: 0,
  },
  chapter: {
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
  highlights: { gap: spacing.sm, flex: 1 },
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
    paddingVertical: spacing.md,
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
