import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ItineraryItemForm } from '@/src/components/itinerary/ItineraryItemForm';
import { Body, Button, Screen } from '@/src/components/ui';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeDayItem } from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';

export default function EditItineraryItemScreen() {
  const { dayId, itemId } = useLocalSearchParams<{ dayId: string; itemId: string }>();
  const { trip } = useTrip();
  const router = useRouter();
  const [item, setItem] = useState<ItineraryItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!trip || !dayId || !itemId) return;
    return subscribeDayItem(trip.id, String(dayId), String(itemId), (next) => {
      setItem(next);
      setReady(true);
    });
  }, [trip, dayId, itemId]);

  if (!dayId || !itemId) {
    return (
      <Screen>
        <Body muted>Atividade não encontrada.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!ready) return null;

  if (!item) {
    return (
      <Screen>
        <Body muted>Atividade não encontrada.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <ItineraryItemForm mode="edit" dayId={String(dayId)} initialItem={item} />
  );
}
