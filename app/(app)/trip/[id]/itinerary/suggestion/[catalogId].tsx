import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CatalogRoleTile } from '@/src/components/itinerary/CatalogRoleTile';
import { Badge, Body, Button, Screen } from '@/src/components/ui';
import { useItineraryDay } from '@/src/hooks/useItineraryDay';
import { useLayout } from '@/src/hooks/useLayout';
import { useTrip } from '@/src/hooks/useTrip';
import {
  BEST_PERIOD_LABELS,
  COST_HINT_LABELS,
  catalogSourceLabel,
  formatDuration,
  subscribeCatalogEntry,
} from '@/src/services/catalog';
import type { ActivityCatalogEntry } from '@/src/types';
import { ACTIVITY_CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

/** Step 2: a suggested rolê in full, with "Adicionar ao Dia N". */
export default function SuggestionDetailScreen() {
  const { catalogId, dayId, order, time } = useLocalSearchParams<{
    catalogId: string;
    dayId: string;
    order?: string;
    time?: string;
  }>();
  const { trip, canMutate } = useTrip();
  const { isWide } = useLayout();
  const router = useRouter();
  const { short } = useItineraryDay(trip?.id, dayId ? String(dayId) : undefined);
  const [entry, setEntry] = useState<ActivityCatalogEntry | null | undefined>(undefined);

  useEffect(() => {
    if (!catalogId) return;
    return subscribeCatalogEntry(String(catalogId), setEntry);
  }, [catalogId]);

  if (!trip || entry === undefined) return null;
  if (!entry) {
    return (
      <Screen>
        <Body muted>Este rolê não está mais disponível.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  const currentTrip = trip;
  const role = entry;

  const tiles = [
    { label: 'Duração', value: formatDuration(role.durationMin) },
    {
      label: 'Melhor',
      value: role.bestPeriod ? BEST_PERIOD_LABELS[role.bestPeriod] : null,
    },
    { label: 'Custo', value: role.costHint ? COST_HINT_LABELS[role.costHint] : null },
  ].filter((t): t is { label: string; value: string } => !!t.value);

  function add() {
    router.push({
      pathname: `/(app)/trip/${currentTrip.id}/itinerary/new-item` as never,
      params: {
        dayId: String(dayId),
        order: String(order ?? '0'),
        catalogId: role.id,
        ...(time ? { time: String(time) } : {}),
      },
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <CatalogRoleTile
          title={role.title}
          category={role.category}
          imageUrl={role.imageUrl}
          size={isWide ? 160 : 120}
          style={[styles.hero, !isWide && styles.heroMobile]}
        />

        <View style={styles.header}>
          <View style={styles.badges}>
            <Badge text={catalogSourceLabel(role)} tone={role.source === 'user' ? 'info' : 'accent'} />
            <Badge text={ACTIVITY_CATEGORY_LABELS[role.category]} tone="neutral" />
          </View>
          <Text style={[styles.title, !isWide && styles.titleMobile]}>{role.title}</Text>
          {role.description ? <Body muted>{role.description}</Body> : null}
        </View>

        {tiles.length ? (
          <View style={styles.tiles}>
            {tiles.map((tile) => (
              <View key={tile.label} style={styles.tile}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileValue}>{tile.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {role.location || role.usageCount > 0 ? (
          <View style={styles.facts}>
            {role.location ? (
              <View style={styles.fact}>
                <Ionicons name="location-outline" size={20} color={colors.inkSoft} />
                <Text style={styles.factText}>{role.location}</Text>
                {role.mapUrl ? (
                  <Pressable onPress={() => Linking.openURL(role.mapUrl!)} hitSlop={8}>
                    <Text style={styles.link}>Mapa</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {role.usageCount > 0 ? (
              <View style={[styles.fact, role.location && styles.factDivided]}>
                <Ionicons name="people-outline" size={20} color={colors.inkSoft} />
                <Text style={styles.factText}>
                  Adicionado em {role.usageCount} {role.usageCount === 1 ? 'viagem' : 'viagens'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.note}>
          Ao adicionar, o grupo recebe uma cópia no {short}. Mudanças que vocês fizerem não alteram a
          sugestão original.
        </Text>
      </ScrollView>

      {canMutate ? (
        <View style={styles.bar}>
          <Button title={`Adicionar ao ${short}`} icon="add" onPress={add} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: 120 },
  hero: { width: '100%', aspectRatio: 16 / 9, maxHeight: 320, borderRadius: radii.xl },
  heroMobile: { maxHeight: 200, borderRadius: radii.lg },
  header: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontFamily: fonts.displayBold, fontSize: 28, letterSpacing: -0.5, color: colors.ink },
  titleMobile: { fontSize: 24 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    padding: 12,
    gap: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  tileValue: { fontFamily: fonts.uiHeavy, fontSize: 16, color: colors.ink },
  facts: {
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  factDivided: { borderTopWidth: 1, borderTopColor: colors.divider },
  factText: { flex: 1, fontFamily: fonts.uiSemi, fontSize: 14, color: colors.ink },
  link: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.accent },
  note: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, color: colors.inkMuted },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.raised,
  },
});
