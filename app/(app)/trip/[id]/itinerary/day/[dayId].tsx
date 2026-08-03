import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { EmptyState, Label, Screen } from '@/src/components/ui';
import { ItineraryCard } from '@/src/components/itinerary/ItineraryCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeDayItems } from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

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
            <View style={styles.sectionHeader}>
              <Label>Programação</Label>
              {canMutate ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: `/(app)/trip/${currentTrip.id}/itinerary/new-item` as never,
                      params: { dayId: String(dayId), order: String(items.length) },
                    })
                  }
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.newAction,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={styles.newActionText}>Nova atividade</Text>
                </Pressable>
              ) : null}
            </View>
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
        renderItem={({ item }) => (
          <ItineraryCard
            item={item}
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
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  newAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newActionText: {
    color: colors.white,
    fontFamily: fonts.uiBold,
    fontSize: 13,
  },
});
