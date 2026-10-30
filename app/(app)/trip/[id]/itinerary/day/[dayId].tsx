import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState, PageHeader, Screen } from '@/src/components/ui';
import { ItineraryAddFab } from '@/src/components/itinerary/ItineraryAddFab';
import { ItineraryDayTimeline } from '@/src/components/itinerary/ItineraryDayTimeline';
import { useAuth } from '@/src/hooks/useAuth';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { spacing } from '@/src/theme';

export default function DayDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
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

  if (!trip || !user) return null;

  const currentTrip = trip;
  const dayIndex = days.findIndex((d) => d.id === dayId);
  const day = dayIndex >= 0 ? days[dayIndex] : null;
  const title = day
    ? `Dia ${dayIndex + 1}${day.title ? ` — ${day.title}` : ''}`
    : 'Programação';
  const subtitle = [
    day ? format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: ptBR }) : null,
    items.length > 0 ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function newActivity() {
    router.push({
      pathname: `/(app)/trip/${currentTrip.id}/itinerary/add` as never,
      params: { dayId: String(dayId), order: String(items.length) },
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <TripClosedBanner trip={currentTrip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
          <PageHeader title={title} subtitle={subtitle || undefined} />
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              title="Dia livre"
              subtitle={
                canMutate
                  ? 'Nada planejado ainda. Que tal a primeira atividade?'
                  : 'Ainda não há atividades neste dia.'
              }
            />
            {canMutate ? (
              <Button title="Planejar o dia" icon="add" size="sm" onPress={newActivity} />
            ) : null}
          </View>
        ) : (
          <ItineraryDayTimeline
            items={items}
            onPressItem={(item) =>
              router.push({
                pathname: `/(app)/trip/${currentTrip.id}/itinerary/item/[itemId]` as never,
                params: { itemId: item.id, dayId: String(dayId) },
              })
            }
          />
        )}
      </ScrollView>

      {canMutate ? <ItineraryAddFab onPress={newActivity} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  headerBlock: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', gap: spacing.sm },
});
