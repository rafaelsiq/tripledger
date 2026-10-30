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
  BEST_PERIOD_LABELS,
  catalogSourceLabel,
  formatDuration,
  recordCatalogUsage,
  submitCatalogSuggestion,
} from '@/src/services/catalog';
import {
  canManageItineraryItem,
  createItineraryItem,
  updateItineraryItem,
} from '@/src/services/itinerary';
import type { ActivityCatalogEntry, ItineraryItem, ItineraryItemKind } from '@/src/types';
import { ITINERARY_ITEM_KIND_LABELS } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

/** Fields a new item starts with: copied from a catalog rolê or one of the user's items. */
export type ItineraryItemPrefill = Partial<
  Pick<ItineraryItem, 'title' | 'description' | 'kind' | 'time' | 'endTime' | 'location' | 'mapUrl' | 'imageUrl'>
>;

type Props = {
  mode: 'create' | 'edit';
  dayId: string;
  order?: number;
  initialTime?: string;
  initialItem?: ItineraryItem;
  prefill?: ItineraryItemPrefill;
  /** The rolê this item is copied from; shows the "Baseado em" banner. */
  catalogEntry?: ActivityCatalogEntry;
};

type Visibility = 'private' | 'public';

const VISIBILITY_OPTIONS: { id: Visibility; title: string; hint: string }[] = [
  { id: 'private', title: 'Só neste grupo', hint: 'Padrão. Ninguém fora da viagem vê.' },
  { id: 'public', title: 'Sugerir para outras viagens', hint: '' },
];

const KIND_OPTIONS: ItineraryItemKind[] = ['activity', 'rest'];

export function ItineraryItemForm({
  mode,
  dayId,
  order = 0,
  initialTime,
  initialItem,
  prefill,
  catalogEntry,
}: Props) {
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { isWide } = useLayout();
  const { showError, showSuccess } = useToast();
  const router = useRouter();

  const start = initialItem ?? prefill;
  const [kind, setKind] = useState<ItineraryItemKind>(start ? itemKind(start) : 'activity');
  const [title, setTitle] = useState(start?.title || '');
  const [description, setDescription] = useState(start?.description || '');
  // A time picked on the storytelling timeline wins over the rolê's suggested one.
  const [time, setTime] = useState(initialItem?.time || initialTime || prefill?.time || '');
  const [endTime, setEndTime] = useState(
    initialItem?.endTime || (initialTime ? '' : prefill?.endTime) || ''
  );
  const [location, setLocation] = useState(start?.location || '');
  const [mapUrl, setMapUrl] = useState(start?.mapUrl || '');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [existingImageUrl, setExistingImageUrl] = useState(start?.imageUrl);
  const [clearImage, setClearImage] = useState(false);
  const [loading, setLoading] = useState(false);
  // Local, descrição, mapa and imagem start collapsed; editing an item that has them opens them.
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [linked, setLinked] = useState(!!catalogEntry);
  const [visibility, setVisibility] = useState<Visibility>('private');

  const isRest = kind === 'rest';
  const fromCatalog = mode === 'create' && linked && !!catalogEntry;
  const canSuggest = !!trip?.destination?.trim();
  const isPublic = mode === 'create' && !fromCatalog && canSuggest && visibility === 'public';

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
        const created = await createItineraryItem({
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
          imageUrl: !clearImage ? existingImageUrl : undefined,
          order,
          createdByUid: user.uid,
          catalogId: fromCatalog ? catalogEntry!.id : undefined,
          visibility: isPublic ? 'submitted' : 'private',
        });
        if (fromCatalog) void recordCatalogUsage(catalogEntry!.id);
        if (isPublic) {
          try {
            await submitCatalogSuggestion({
              destination: trip.destination!,
              item: created,
              uid: user.uid,
            });
            showSuccess('Salvo no roteiro', 'Sugestão enviada para revisão');
          } catch (e) {
            // The item is already in the itinerary; only the suggestion failed.
            showError(e, 'Salvo no roteiro, mas a sugestão não foi enviada');
          }
        } else {
          showSuccess(isRest ? 'Descanso adicionado ao roteiro' : 'Atividade adicionada ao roteiro');
        }
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

        {fromCatalog ? (
          <View style={styles.basedOn}>
            <Ionicons name="star-outline" size={18} color={colors.accentDark} />
            <Text style={styles.basedOnText} numberOfLines={2}>
              Baseado em <Text style={styles.basedOnStrong}>{catalogEntry!.title}</Text> ·{' '}
              {catalogSourceLabel(catalogEntry!)}
            </Text>
            <Pressable onPress={() => setLinked(false)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.basedOnAction}>Desvincular</Text>
            </Pressable>
          </View>
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
          {fromCatalog && catalogEntry!.bestPeriod && catalogEntry!.bestPeriod !== 'any' ? (
            <Text style={styles.hint}>
              Horário sugerido: melhor de {BEST_PERIOD_LABELS[catalogEntry!.bestPeriod].toLowerCase()}
              {catalogEntry!.durationMin ? `, ${formatDuration(catalogEntry!.durationMin)}` : ''}.
            </Text>
          ) : null}
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

        {mode === 'create' ? (
          <View style={styles.section}>
            <SectionHeader title="Quem vê este rolê" />
            {fromCatalog ? (
              <Card style={styles.visNote}>
                <Ionicons name="globe-outline" size={20} color={colors.accent} />
                <Text style={styles.visNoteText}>
                  Este rolê já é uma sugestão pública. O que vocês mudarem aqui fica só neste grupo.
                </Text>
              </Card>
            ) : (
              <>
                <View style={styles.visGroup} accessibilityRole="radiogroup">
                  {VISIBILITY_OPTIONS.map((option, index) => {
                    const selected = visibility === option.id;
                    const disabled = option.id === 'public' && !canSuggest;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => setVisibility(option.id)}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled }}
                        style={[
                          styles.visOption,
                          index > 0 && styles.visOptionDivided,
                          selected && styles.visOptionOn,
                          disabled && { opacity: 0.5 },
                        ]}
                      >
                        <View style={[styles.radio, selected && styles.radioOn]}>
                          {selected ? <View style={styles.radioDot} /> : null}
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={styles.visTitle}>{option.title}</Text>
                          <Text style={styles.hint}>
                            {disabled
                              ? 'Disponível quando a viagem tem um destino.'
                              : option.id === 'public'
                                ? `Entra na lista de rolês de ${trip?.destination?.trim()} depois da revisão.`
                                : option.hint}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {isPublic ? (
                  <View style={styles.visInfo}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                    <Text style={styles.visInfoText}>
                      Vai para revisão antes de aparecer para outros grupos. Título, descrição, local,
                      mapa e foto são compartilhados; horários, votos e seu grupo não.
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <Button
          title={
            mode === 'edit' ? 'Salvar alterações' : isPublic ? 'Salvar e enviar sugestão' : 'Salvar no roteiro'
          }
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
  basedOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  basedOnText: { flex: 1, fontFamily: fonts.uiSemi, fontSize: 13, color: colors.accentDark },
  basedOnStrong: { fontFamily: fonts.uiHeavy },
  basedOnAction: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.accentDark },
  visNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  visNoteText: { flex: 1, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  visGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  visOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  visOptionDivided: { borderTopWidth: 1, borderTopColor: colors.divider },
  visOptionOn: { backgroundColor: colors.accentSoft },
  visTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  visInfo: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    backgroundColor: colors.infoSoft,
  },
  visInfoText: { flex: 1, fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, color: colors.info },
});
