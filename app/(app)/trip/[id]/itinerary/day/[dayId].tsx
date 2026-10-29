import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState, PageHeader, Screen } from '@/src/components/ui';
import { ItineraryCard } from '@/src/components/itinerary/ItineraryCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeDayItems } from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';
import { spacing } from '@/src/theme';

export default function DayDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItineraryItem[]>([]);

  useEffect(() => {
    if (!trip || !dayId) return;
    return subscribeDayItems(trip.id, String(dayId), setItems);
  }, [trip, dayId]);

  if (!trip || !user) return null;

  const currentTrip = trip;

  return (
    <Screen>
      <FlatList
        style={styles.listFlex}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TripClosedBanner
              trip={currentTrip}
              isAdmin={isAdmin}
              isFinanceLead={isFinanceLead}
            />
            <PageHeader
              title="Programação"
              subtitle={
                items.length > 0
                  ? `${items.length} ${items.length === 1 ? 'item' : 'itens'} no dia`
                  : undefined
              }
              actions={
                canMutate ? (
                  <Button
                    title="Atividade"
                    icon="add"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: `/(app)/trip/${currentTrip.id}/itinerary/new-item` as never,
                        params: { dayId: String(dayId), order: String(items.length) },
                      })
                    }
                  />
                ) : undefined
              }
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Dia livre"
            subtitle={
              canMutate
                ? 'Toque em Nova atividade para montar o dia.'
                : 'Ainda não há atividades neste dia.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <ItineraryCard
            item={item}
            isLast={index === items.length - 1}
            onPress={() =>
              router.push({
                pathname: `/(app)/trip/${currentTrip.id}/itinerary/item/[itemId]` as never,
                params: { itemId: item.id, dayId: String(dayId) },
              })
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listFlex: { flex: 1 },
  list: {
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
