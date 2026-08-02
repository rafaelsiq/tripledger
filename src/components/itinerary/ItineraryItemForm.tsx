import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  canManageItineraryItem,
  createItineraryItem,
  updateItineraryItem,
} from '@/src/services/itinerary';
import type { ItineraryItem } from '@/src/types';
import { spacing } from '@/src/theme';

type Props = {
  mode: 'create' | 'edit';
  dayId: string;
  order?: number;
  initialItem?: ItineraryItem;
};

export function ItineraryItemForm({ mode, dayId, order = 0, initialItem }: Props) {
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState(initialItem?.title || '');
  const [description, setDescription] = useState(initialItem?.description || '');
  const [time, setTime] = useState(initialItem?.time || '');
  const [location, setLocation] = useState(initialItem?.location || '');
  const [mapUrl, setMapUrl] = useState(initialItem?.mapUrl || '');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [existingImageUrl, setExistingImageUrl] = useState(initialItem?.imageUrl);
  const [clearImage, setClearImage] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !initialItem) return;
    setTitle(initialItem.title || '');
    setDescription(initialItem.description || '');
    setTime(initialItem.time || '');
    setLocation(initialItem.location || '');
    setMapUrl(initialItem.mapUrl || '');
    setExistingImageUrl(initialItem.imageUrl);
    setClearImage(false);
    setImageUri(undefined);
  }, [mode, initialItem]);

  const canEdit =
    mode === 'create'
      ? canMutate
      : !!user &&
        !!initialItem &&
        canMutate &&
        canManageItineraryItem(initialItem, { uid: user.uid, isAdmin });

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri);
      setClearImage(false);
    }
  }

  function removeImage() {
    setImageUri(undefined);
    setExistingImageUrl(undefined);
    setClearImage(true);
  }

  async function onSave() {
    if (!trip || !user || !dayId) {
      showError('Sessão ou dia indisponível.', 'Não foi possível salvar');
      return;
    }
    if (!canEdit) {
      showError(
        mode === 'edit'
          ? 'Apenas o autor ou o administrador podem editar.'
          : closedTripMemberMessage(),
        'Sem permissão'
      );
      return;
    }
    if (!title.trim()) {
      showError('Informe um título.', 'Campo obrigatório');
      return;
    }
    try {
      setLoading(true);
      if (mode === 'edit' && initialItem) {
        await updateItineraryItem({
          tripId: trip.id,
          dayId: String(dayId),
          item: initialItem,
          actorUid: user.uid,
          title,
          description,
          time,
          location,
          mapUrl,
          imageUri,
          clearImage: clearImage && !imageUri,
        });
        showSuccess('Atividade atualizada');
      } else {
        await createItineraryItem({
          tripId: trip.id,
          dayId: String(dayId),
          title,
          description,
          time,
          location,
          mapUrl,
          imageUri,
          order,
          createdByUid: user.uid,
        });
        showSuccess('Atividade adicionada ao roteiro');
      }
      router.back();
    } catch (e) {
      showError(e, mode === 'edit' ? 'Falha ao atualizar' : 'Falha ao salvar');
    } finally {
      setLoading(false);
    }
  }

  if (trip && !canEdit) {
    return (
      <Screen>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <Body muted>
          {mode === 'edit'
            ? 'Apenas o autor ou o administrador podem editar esta atividade.'
            : closedTripMemberMessage()}
        </Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (mode === 'edit' && !initialItem) {
    return (
      <Screen>
        <Body muted>Atividade não encontrada.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const hasImage = !!imageUri || (!!existingImageUrl && !clearImage);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.form}>
        {trip ? (
          <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        ) : null}
        <Input
          label="Título"
          value={title}
          onChangeText={setTitle}
          placeholder="Trilha da Lagoinha"
        />
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
          title={hasImage ? 'Imagem selecionada' : 'Adicionar imagem (opcional)'}
          variant="secondary"
          onPress={pickImage}
        />
        {hasImage ? (
          <Button title="Remover imagem" variant="ghost" onPress={removeImage} />
        ) : null}
        <Button
          title={mode === 'edit' ? 'Salvar alterações' : 'Salvar no roteiro'}
          onPress={onSave}
          loading={loading}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
});
