import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ItineraryItemForm } from '@/src/components/itinerary/ItineraryItemForm';
import { Body, Button, Screen } from '@/src/components/ui';
import { useRouter } from 'expo-router';

export default function NewItineraryItem() {
  const { dayId, order } = useLocalSearchParams<{ dayId: string; order?: string }>();
  const router = useRouter();

  if (!dayId) {
    return (
      <Screen>
        <Body muted>Dia não encontrado.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <ItineraryItemForm mode="create" dayId={String(dayId)} order={Number(order) || 0} />
  );
}
