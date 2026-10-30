import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CatalogRoleTile } from '@/src/components/itinerary/CatalogRoleTile';
import { EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useItineraryDay } from '@/src/hooks/useItineraryDay';
import { useTrip } from '@/src/hooks/useTrip';
import { destinationKey, slugify } from '@/src/lib/destinations';
import {
  BEST_PERIOD_LABELS,
  catalogSourceLabel,
  formatDuration,
  formatEventDates,
  isAvailableOn,
  subscribeIsCatalogCurator,
  subscribePublishedCatalog,
} from '@/src/services/catalog';
import { subscribeTripItineraryItems } from '@/src/services/itinerary';
import type { ActivityCatalogEntry, ActivityCategory, ItineraryItem } from '@/src/types';
import { ACTIVITY_CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

type Filter = ActivityCategory | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  ...(Object.keys(ACTIVITY_CATEGORY_LABELS) as ActivityCategory[]).map((id) => ({
    id,
    label: ACTIVITY_CATEGORY_LABELS[id],
  })),
];

const MAX_OWN = 5;

function roleMeta(entry: ActivityCatalogEntry) {
  return [
    ACTIVITY_CATEGORY_LABELS[entry.category],
    formatDuration(entry.durationMin),
    entry.bestPeriod && entry.bestPeriod !== 'any'
      ? `melhor ${BEST_PERIOD_LABELS[entry.bestPeriod].toLowerCase()}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Step 1 of a new activity: pick a suggested rolê for the trip's destination or start from scratch. */
export default function AddToDayScreen() {
  const { dayId, order, time } = useLocalSearchParams<{ dayId: string; order?: string; time?: string }>();
  const { trip } = useTrip();
  const { user } = useAuth();
  const router = useRouter();
  const { days, day, eyebrow } = useItineraryDay(trip?.id, dayId ? String(dayId) : undefined);
  const [catalog, setCatalog] = useState<ActivityCatalogEntry[] | null>(null);
  const [itemsByDay, setItemsByDay] = useState<Record<string, ItineraryItem[]>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [isCurator, setIsCurator] = useState(false);

  const key = destinationKey(trip?.destination);

  useEffect(() => {
    if (!key) {
      setCatalog([]);
      return;
    }
    return subscribePublishedCatalog(key, setCatalog);
  }, [key]);

  const dayIdsKey = useMemo(() => days.map((d) => d.id).join('|'), [days]);
  useEffect(() => {
    if (!trip) return;
    return subscribeTripItineraryItems(trip.id, dayIdsKey ? dayIdsKey.split('|') : [], setItemsByDay);
  }, [trip, dayIdsKey]);

  useEffect(() => {
    if (!user) return;
    return subscribeIsCatalogCurator(user.uid, setIsCurator);
  }, [user]);

  const shown = useMemo(() => {
    const needle = slugify(search);
    return (catalog ?? [])
      .filter(
        (entry) =>
          isAvailableOn(entry, day?.date) &&
          (filter === 'all' || entry.category === filter) &&
          (!needle || slugify(`${entry.title} ${entry.location ?? ''}`).includes(needle))
      )
      // Events happening that day first; otherwise keep most-used order.
      .sort((a, b) => Number(!!b.eventStart) - Number(!!a.eventStart));
  }, [catalog, filter, search, day?.date]);

  // The user's own rolês in this trip that never came from the catalog, to repeat on another day.
  const ownRoles = useMemo(() => {
    if (!user) return [];
    const seen = new Set<string>();
    const out: ItineraryItem[] = [];
    for (const items of Object.values(itemsByDay)) {
      for (const item of items) {
        const titleKey = slugify(item.title);
        if (item.createdByUid !== user.uid || item.catalogId || seen.has(titleKey)) continue;
        seen.add(titleKey);
        out.push(item);
      }
    }
    return out.slice(0, MAX_OWN);
  }, [itemsByDay, user]);

  if (!trip || !dayId) return null;
  const currentTrip = trip;

  const baseParams = {
    dayId: String(dayId),
    order: String(order ?? '0'),
    ...(time ? { time: String(time) } : {}),
  };

  function newItem(extra: Record<string, string> = {}) {
    router.push({
      pathname: `/(app)/trip/${currentTrip.id}/itinerary/new-item` as never,
      params: { ...baseParams, ...extra },
    });
  }

  function openRole(entry: ActivityCatalogEntry) {
    router.push({
      pathname: `/(app)/trip/${currentTrip.id}/itinerary/suggestion/[catalogId]` as never,
      params: { ...baseParams, catalogId: entry.id },
    });
  }

  const destinationName = currentTrip.destination?.trim();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>Adicionar ao dia</Text>
          </View>
          {isCurator ? (
            <Pressable
              onPress={() => router.push(`/(app)/trip/${currentTrip.id}/itinerary/curation` as never)}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.curationLink}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
              <Text style={styles.link}>Curadoria</Text>
            </Pressable>
          ) : null}
        </View>

        {key ? (
          <>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.inkMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={`Buscar rolês em ${destinationName}`}
                placeholderTextColor={colors.inkMuted}
                accessibilityLabel="Buscar rolês"
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={styles.chipsRow}
            >
              {FILTERS.map((f) => {
                const on = f.id === filter;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <Pressable
          onPress={() => newItem()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.scratch, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.scratchIcon}>
            <Ionicons name="add" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.scratchTitle}>Criar do zero</Text>
            <Text style={styles.scratchHint}>Atividade ou descanso que não está na lista</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.accentDark} />
        </Pressable>

        {key ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Sugestões para {destinationName}</Text>
              {catalog ? (
                <Text style={styles.sectionCount}>
                  {shown.length} {shown.length === 1 ? 'rolê' : 'rolês'}
                </Text>
              ) : null}
            </View>

            {catalog && catalog.length === 0 ? (
              <EmptyState
                title="Ainda sem sugestões"
                subtitle={`Crie do zero e marque "Sugerir para outras viagens" para começar a lista de ${destinationName}.`}
              />
            ) : catalog && shown.length === 0 ? (
              <EmptyState title="Nada encontrado" subtitle="Tente outra categoria ou busca." />
            ) : (
              shown.map((entry) => (
                <View key={entry.id} style={styles.row}>
                  <Pressable
                    onPress={() => openRole(entry)}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.title}, ${roleMeta(entry)}`}
                    style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.85 }]}
                  >
                    <CatalogRoleTile title={entry.title} category={entry.category} imageUrl={entry.imageUrl} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {roleMeta(entry)}
                      </Text>
                      <View style={styles.rowBadges}>
                        <View style={[styles.badge, entry.source === 'user' ? styles.badgeCommunity : styles.badgeCurated]}>
                          <Text
                            style={[
                              styles.badgeText,
                              { color: entry.source === 'user' ? colors.info : colors.accentDark },
                            ]}
                          >
                            {catalogSourceLabel(entry)}
                          </Text>
                        </View>
                        {entry.eventStart ? (
                          <View style={[styles.badge, styles.badgeEvent]}>
                            <Text style={[styles.badgeText, { color: colors.warn }]}>
                              Evento · {formatEventDates(entry)}
                            </Text>
                          </View>
                        ) : null}
                        {entry.usageCount > 0 ? (
                          <Text style={styles.used}>
                            em {entry.usageCount} {entry.usageCount === 1 ? 'viagem' : 'viagens'}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => newItem({ catalogId: entry.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Adicionar ${entry.title} ao dia`}
                    hitSlop={4}
                    style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="add" size={22} color={colors.accent} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : (
          <EmptyState
            title="Sem destino definido"
            subtitle="As sugestões de rolês aparecem quando a viagem tem um destino."
          />
        )}

        {ownRoles.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seus rolês privados</Text>
            {ownRoles.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <View style={styles.lockTile}>
                    <Ionicons name="lock-closed-outline" size={22} color={colors.inkSoft} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowMeta}>
                      Criado por você · {item.visibility === 'submitted' ? 'sugerido também' : 'só neste grupo'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => newItem({ fromDayId: item.dayId, fromItemId: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar ${item.title} ao dia`}
                  hitSlop={4}
                  style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="add" size={22} color={colors.accent} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: { fontFamily: fonts.uiHeavy, fontSize: 22, color: colors.ink },
  curationLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  link: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.accent },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontFamily: fonts.ui, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  chipsRow: { flexGrow: 0 },
  chips: { gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkLabel },
  chipTextOn: { fontFamily: fonts.uiBold, color: colors.white },
  scratch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  scratchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scratchTitle: { fontFamily: fonts.uiHeavy, fontSize: 15, color: colors.accentDark },
  scratchHint: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkSoft },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  sectionTitle: {
    fontFamily: fonts.uiHeavy,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    flexShrink: 1,
  },
  sectionCount: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.inkMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink },
  rowMeta: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkSoft },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  badgeCurated: { backgroundColor: colors.accentSoft },
  badgeCommunity: { backgroundColor: colors.infoSoft },
  badgeEvent: { backgroundColor: colors.warnSoft },
  badgeText: { fontFamily: fonts.uiBold, fontSize: 11 },
  used: { fontFamily: fonts.uiSemi, fontSize: 11, color: colors.inkMuted },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTile: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
