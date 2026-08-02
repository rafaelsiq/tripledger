import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState } from '@/src/components/ui';
import { ItineraryCard } from '@/src/components/itinerary/ItineraryCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useTrip } from '@/src/hooks/useTrip';
import { useToast } from '@/src/hooks/useToast';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  addTemplateSlots,
  subscribeDayItems,
  toggleItemDone,
  toggleRsvp,
} from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';
import { colors, spacing } from '@/src/theme';

export default function DayDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { showError } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<ItineraryItem[]>([]);

  useEffect(() => {
    if (!trip || !dayId) return;
    return subscribeDayItems(trip.id, String(dayId), setItems);
  }, [trip, dayId]);

  if (!trip || !user) return null;

  function guardMutate(action: () => void) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    action();
  }

  return (
    <View style={styles.screen}>
      <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      {canMutate ? (
        <View style={styles.actions}>
          <Button
            title="Adicionar item"
            onPress={() =>
              router.push({
                pathname: `/(app)/trip/${trip.id}/itinerary/new-item`,
                params: { dayId: String(dayId), order: String(items.length) },
              })
            }
          />
          <Button
            title="Template manhã/tarde/noite"
            variant="secondary"
            onPress={() =>
              addTemplateSlots(trip.id, String(dayId), user.uid, items.length)
            }
          />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState title="Dia livre" subtitle="Adicione cards com imagem e texto." />
        }
        renderItem={({ item }) => (
          <ItineraryCard
            item={item}
            attending={item.attendees.includes(user.uid)}
            onToggleDone={() =>
              guardMutate(() =>
                toggleItemDone(trip.id, String(dayId), item.id, !item.done)
              )
            }
            onToggleRsvp={() =>
              guardMutate(() => toggleRsvp(trip.id, String(dayId), item, user.uid))
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  actions: { gap: spacing.sm, marginBottom: spacing.md },
});
