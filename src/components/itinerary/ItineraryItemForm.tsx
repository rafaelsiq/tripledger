import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Input, Label, Screen } from '@/src/components/ui';
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
import { colors, fonts, radii, spacing } from '@/src/theme';

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

        <View style={styles.kindBlock}>
          <Label>Tipo</Label>
          <View style={styles.kindRow}>
            {KIND_OPTIONS.map((option) => {
              const selected = kind === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setKind(option)}
                  style={({ pressed }) => [
                    styles.kindChip,
                    selected && styles.kindChipOn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.kindChipText, selected && styles.kindChipTextOn]}>
                    {ITINERARY_ITEM_KIND_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Título"
          value={title}
          onChangeText={setTitle}
          placeholder={isRest ? 'Descanso na casa' : 'Trilha da Lagoinha'}
        />
        <Input
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          placeholder={isRest ? 'Pausa para almoço / regenerar' : 'Levar água e protetor'}
        />
        <View style={[styles.timeRow, !isWide && styles.timeRowStacked]}>
          <View style={styles.timeField}>
            <Input
              label={isRest ? 'Início' : 'Horário de ida'}
              value={time}
              onChangeText={setTime}
              placeholder="09:30"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.timeField}>
            <Input
              label={isRest ? 'Fim' : 'Volta à estadia'}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="12:00"
              autoCapitalize="none"
            />
          </View>
        </View>
        <Body muted>
          {isRest
            ? 'Defina o bloco de descanso com início e fim.'
            : 'Ida = saída da estadia. Volta = retorno à estadia.'}
        </Body>
        <Input
          label="Local"
          value={location}
          onChangeText={setLocation}
          placeholder={isRest ? 'Estadia' : 'Praia da Lagoinha'}
        />
        {!isRest ? (
          <Input
            label="Link do mapa"
            value={mapUrl}
            onChangeText={setMapUrl}
            placeholder="https://maps.google.com/..."
          />
        ) : null}
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
  kindBlock: { gap: spacing.xs },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kindChipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: '#C6E3DB',
  },
  kindChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.inkSoft,
  },
  kindChipTextOn: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeRowStacked: {
    flexDirection: 'column',
  },
  timeField: {
    flex: 1,
  },
});
