import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Card, Input, Screen, SectionHeader, Segmented } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { itemKind, parseItemTime } from '@/src/lib/itineraryStory';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  canManageItineraryItem,
  createItineraryItem,
  updateItineraryItem,
} from '@/src/services/itinerary';
import type { ItineraryItem, ItineraryItemKind } from '@/src/types';
import { ITINERARY_ITEM_KIND_LABELS } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

type Props = {
  mode: 'create' | 'edit';
  dayId: string;
  order?: number;
  initialTime?: string;
  initialItem?: ItineraryItem;
};

const KIND_OPTIONS: ItineraryItemKind[] = ['activity', 'rest'];

export function ItineraryItemForm({
  mode,
  dayId,
  order = 0,
  initialTime,
  initialItem,
}: Props) {
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { isWide } = useLayout();
  const { showError, showSuccess } = useToast();
  const router = useRouter();

  const [kind, setKind] = useState<ItineraryItemKind>(
    initialItem ? itemKind(initialItem) : 'activity'
  );
  const [title, setTitle] = useState(initialItem?.title || '');
  const [description, setDescription] = useState(initialItem?.description || '');
  const [time, setTime] = useState(initialItem?.time || initialTime || '');
  const [endTime, setEndTime] = useState(initialItem?.endTime || '');
  const [location, setLocation] = useState(initialItem?.location || '');
  const [mapUrl, setMapUrl] = useState(initialItem?.mapUrl || '');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [existingImageUrl, setExistingImageUrl] = useState(initialItem?.imageUrl);
  const [clearImage, setClearImage] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRest = kind === 'rest';

  useEffect(() => {
    if (mode !== 'create' || !initialTime) return;
    setTime((prev) => prev || initialTime);
  }, [mode, initialTime]);

  useEffect(() => {
    if (mode !== 'edit' || !initialItem) return;
    setKind(itemKind(initialItem));
    setTitle(initialItem.title || '');
    setDescription(initialItem.description || '');
    setTime(initialItem.time || '');
    setEndTime(initialItem.endTime || '');
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

    const startMinutes = parseItemTime(time);
    const endMinutes = parseItemTime(endTime);
    const startLabel = isRest ? 'Início do descanso' : 'Horário de ida';
    const endLabel = isRest ? 'Fim do descanso' : 'Horário de volta à estadia';

    if (startMinutes === null) {
      showError('Use o formato HH:mm (ex.: 09:30).', startLabel);
      return;
    }
    if (endMinutes === null) {
      showError('Use o formato HH:mm (ex.: 12:00).', endLabel);
      return;
    }
    if (endMinutes <= startMinutes) {
      showError(
        isRest
          ? 'O fim do descanso precisa ser depois do início.'
          : 'A volta à estadia precisa ser depois da ida.',
        'Horários'
      );
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
          kind,
          time,
          endTime,
          location,
          mapUrl,
          imageUri,
          clearImage: clearImage && !imageUri,
        });
        showSuccess(isRest ? 'Descanso atualizado' : 'Atividade atualizada');
      } else {
        await createItineraryItem({
          tripId: trip.id,
          dayId: String(dayId),
          title,
          description,
          kind,
          time,
          endTime,
          location,
          mapUrl,
          imageUri,
          order,
          createdByUid: user.uid,
        });
        showSuccess(isRest ? 'Descanso adicionado ao roteiro' : 'Atividade adicionada ao roteiro');
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
            ? 'Apenas o autor ou o administrador podem editar este item.'
            : closedTripMemberMessage()}
        </Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (mode === 'edit' && !initialItem) {
    return (
      <Screen>
        <Body muted>Item não encontrado.</Body>
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

        <Segmented
          options={KIND_OPTIONS.map((id) => ({ id, label: ITINERARY_ITEM_KIND_LABELS[id] }))}
          value={kind}
          onChange={setKind}
        />

        <Card style={styles.card}>
          <Input
            label="Título"
            value={title}
            onChangeText={setTitle}
            placeholder={isRest ? 'Descanso na casa' : 'Trilha da Lagoinha'}
          />
          <Input
            label="Descrição (opcional)"
            value={description}
            onChangeText={setDescription}
            placeholder={isRest ? 'Pausa para almoço / regenerar' : 'Levar água e protetor'}
            multiline
            style={styles.multiline}
          />
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Quando e onde" />
          <Card style={styles.card}>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Input
                  label={isRest ? 'Início' : 'Saída'}
                  value={time}
                  onChangeText={setTime}
                  placeholder="09:30"
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeField}>
                <Input
                  label={isRest ? 'Fim' : 'Volta à estadia'}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="12:00"
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Text style={styles.hint}>
              {isRest
                ? 'Defina o bloco de descanso com início e fim.'
                : 'Saída = quando o grupo deixa a estadia. Volta = retorno à estadia.'}
            </Text>
            <Input
              label="Local"
              value={location}
              onChangeText={setLocation}
              placeholder={isRest ? 'Estadia' : 'Praia da Lagoinha'}
            />
            {!isRest ? (
              <Input
                label="Link do mapa (opcional)"
                value={mapUrl}
                onChangeText={setMapUrl}
                placeholder="https://maps.google.com/..."
                autoCapitalize="none"
              />
            ) : null}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Imagem" />
          <View style={styles.imageRow}>
            <Button
              title={hasImage ? 'Trocar imagem' : 'Adicionar imagem'}
              icon="image-outline"
              variant="secondary"
              size="sm"
              onPress={pickImage}
            />
            {hasImage ? (
              <Button title="Remover" variant="ghost" size="sm" onPress={removeImage} />
            ) : (
              <Text style={styles.hint}>Opcional</Text>
            )}
          </View>
        </View>

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
  form: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  card: { gap: spacing.md },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  hint: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
