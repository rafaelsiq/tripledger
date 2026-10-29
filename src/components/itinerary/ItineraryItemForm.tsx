import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { TimeField } from '@/src/components/TimeField';
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
  // Local, descrição, mapa and imagem start collapsed; editing an item that has them opens them.
  const [extrasOpen, setExtrasOpen] = useState(false);

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
    setExtrasOpen(
      !!(initialItem.location || initialItem.description || initialItem.mapUrl || initialItem.imageUrl)
    );
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

    // Times are optional (picked, never typed); only check the order when both are set.
    const startMinutes = parseItemTime(time);
    const endMinutes = parseItemTime(endTime);
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      showError(
        isRest
          ? 'O fim do descanso precisa ser depois do início.'
          : 'A volta à estadia precisa ser depois da saída.',
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

  const previewUri = imageUri || (!clearImage ? existingImageUrl : undefined);
  const extrasSummary = [
    location.trim() ? 'local' : null,
    description.trim() ? 'descrição' : null,
    !isRest && mapUrl.trim() ? 'mapa' : null,
    previewUri ? 'imagem' : null,
  ]
    .filter(Boolean)
    .join(', ');

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
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <TimeField label={isRest ? 'Início' : 'Saída'} value={time} onChange={setTime} />
            </View>
            <View style={styles.timeField}>
              <TimeField
                label={isRest ? 'Fim' : 'Volta à estadia'}
                value={endTime}
                onChange={setEndTime}
              />
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Pressable
            onPress={() => setExtrasOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: extrasOpen }}
            style={styles.extrasToggle}
          >
            <SectionHeader title="Mais detalhes" />
            <View style={styles.extrasHint}>
              {!extrasOpen && extrasSummary ? (
                <Text style={styles.hint} numberOfLines={1}>
                  {extrasSummary}
                </Text>
              ) : null}
              <Ionicons
                name={extrasOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.inkSoft}
              />
            </View>
          </Pressable>

          {extrasOpen ? (
            <Card style={styles.card}>
              <Input
                label="Local"
                value={location}
                onChangeText={setLocation}
                placeholder={isRest ? 'Estadia' : 'Praia da Lagoinha'}
              />
              <Input
                label="Descrição"
                value={description}
                onChangeText={setDescription}
                placeholder={isRest ? 'Pausa para almoço / regenerar' : 'Levar água e protetor'}
                multiline
                style={styles.multiline}
              />
              {!isRest ? (
                <Input
                  label="Link do mapa"
                  value={mapUrl}
                  onChangeText={setMapUrl}
                  placeholder="https://maps.google.com/..."
                  autoCapitalize="none"
                />
              ) : null}

              <View style={styles.imageRow}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="image-outline" size={22} color={colors.inkMuted} />
                  </View>
                )}
                <View style={styles.imageText}>
                  <Text style={styles.imageLabel}>
                    {previewUri ? 'Imagem adicionada' : 'Sem imagem'}
                  </Text>
                  <View style={styles.imageActions}>
                    <Button
                      title={previewUri ? 'Trocar' : 'Adicionar imagem'}
                      variant="secondary"
                      size="sm"
                      onPress={pickImage}
                    />
                    {previewUri ? (
                      <Button title="Remover" variant="ghost" size="sm" onPress={removeImage} />
                    ) : null}
                  </View>
                </View>
              </View>
            </Card>
          ) : null}
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
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 32,
  },
  extrasHint: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  imageText: { flex: 1, gap: 6 },
  imageLabel: { fontFamily: fonts.uiSemi, fontSize: 14, color: colors.ink },
  imageActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
