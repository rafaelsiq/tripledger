import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ItineraryItemForm,
  type ItineraryItemPrefill,
} from '@/src/components/itinerary/ItineraryItemForm';
import { Body, Button, Screen } from '@/src/components/ui';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeCatalogEntry, suggestedTimes } from '@/src/services/catalog';
import { subscribeDayItem } from '@/src/services/itinerary';
import type { ActivityCatalogEntry } from '@/src/types';

/**
 * New item form. Starts empty, from a catalog rolê (`catalogId`) or as a copy of one
 * of the user's items (`fromDayId` + `fromItemId`).
 */
export default function NewItineraryItem() {
  const { dayId, order, time, catalogId, fromDayId, fromItemId } = useLocalSearchParams<{
    dayId: string;
    order?: string;
    time?: string;
    catalogId?: string;
    fromDayId?: string;
    fromItemId?: string;
  }>();
  const router = useRouter();
  const { trip } = useTrip();
  const needsSource = !!catalogId || !!(fromDayId && fromItemId);
  const [prefill, setPrefill] = useState<ItineraryItemPrefill | undefined>();
  const [catalogEntry, setCatalogEntry] = useState<ActivityCatalogEntry | undefined>();
  const [ready, setReady] = useState(!needsSource);

  useEffect(() => {
    if (!catalogId) return;
    // Read once: the form keeps its own copy, so later catalog edits must not reset it.
    let done = false;
    const unsubscribe = subscribeCatalogEntry(String(catalogId), (entry) => {
      if (done) return;
      done = true;
      if (entry) {
        setCatalogEntry(entry);
        setPrefill({
          title: entry.title,
          description: entry.description,
          kind: entry.kind,
          location: entry.location,
          mapUrl: entry.mapUrl,
          imageUrl: entry.imageUrl,
          imageCredit: entry.imageCredit,
          imageSourceUrl: entry.imageSourceUrl,
          ...suggestedTimes(entry),
        });
      }
      setReady(true);
    });
    return unsubscribe;
  }, [catalogId]);

  useEffect(() => {
    if (!trip || !fromDayId || !fromItemId || catalogId) return;
    let done = false;
    const unsubscribe = subscribeDayItem(trip.id, String(fromDayId), String(fromItemId), (item) => {
      if (done) return;
      done = true;
      if (item) {
        setPrefill({
          title: item.title,
          description: item.description,
          kind: item.kind,
          location: item.location,
          mapUrl: item.mapUrl,
          imageUrl: item.imageUrl,
          imageCredit: item.imageCredit,
          imageSourceUrl: item.imageSourceUrl,
        });
      }
      setReady(true);
    });
    return unsubscribe;
  }, [trip, fromDayId, fromItemId, catalogId]);

  if (!dayId) {
    return (
      <Screen>
        <Body muted>Dia não encontrado.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!ready) return null;

  return (
    <ItineraryItemForm
      mode="create"
      dayId={String(dayId)}
      order={Number(order) || 0}
      initialTime={time ? String(time) : undefined}
      prefill={prefill}
      catalogEntry={catalogEntry}
    />
  );
}
