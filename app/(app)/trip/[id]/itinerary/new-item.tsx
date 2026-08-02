import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import { createItineraryItem } from '@/src/services/itinerary';
import { spacing } from '@/src/theme';

export default function NewItineraryItem() {
  const { dayId, order } = useLocalSearchParams<{ dayId: string; order?: string }>();
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled) setImageUri(result.assets[0]?.uri);
  }

  async function onSave() {
    if (!trip || !user || !dayId) {
      showError('Sessão ou dia indisponível.', 'Não foi possível salvar');
      return;
    }
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (!title.trim()) {
      showError('Informe um título.', 'Campo obrigatório');
      return;
    }
    try {
      setLoading(true);
      await createItineraryItem({
        tripId: trip.id,
        dayId: String(dayId),
        title,
        description,
        time,
        location,
        mapUrl,
        imageUri,
        order: Number(order) || 0,
        createdByUid: user.uid,
      });
      showSuccess('Item adicionado ao roteiro');
      router.back();
    } catch (e) {
      showError(e, 'Falha ao salvar');
    } finally {
      setLoading(false);
    }
  }

  if (trip && !canMutate) {
    return (
      <Screen>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <Body muted>{closedTripMemberMessage()}</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.form}>
        {trip ? (
          <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        ) : null}
        <Input label="Título" value={title} onChangeText={setTitle} placeholder="Trilha da Lagoinha" />
        <Input
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          placeholder="Levar água e protetor"
        />
        <Input label="Horário" value={time} onChangeText={setTime} placeholder="09:30" />
        <Input
          label="Local"
          value={location}
          onChangeText={setLocation}
          placeholder="Praia da Lagoinha"
        />
        <Input
          label="Link do mapa"
          value={mapUrl}
          onChangeText={setMapUrl}
          placeholder="https://maps.google.com/..."
        />
        <Button
          title={imageUri ? 'Imagem selecionada' : 'Adicionar imagem'}
          variant="secondary"
          onPress={pickImage}
        />
        <Button title="Salvar no roteiro" onPress={onSave} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
});
