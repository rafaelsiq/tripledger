import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripPhasePromptBanner } from '@/src/components/TripPhaseBanner';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  SectionHeader,
} from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { formatDateLabel } from '@/src/lib/dates';
import { normalizeTripPhase, phaseLabel, phaseTone } from '@/src/lib/tripPhase';
import { logout } from '@/src/services/auth';
import { subscribeUserTrips } from '@/src/services/trips';
import type { Trip, TripPhase } from '@/src/types';
import { PHASE_LABELS, TRIP_PHASES } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

type PhaseFilter = 'all' | TripPhase;

const PHASE_FILTERS: { id: PhaseFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  ...TRIP_PHASES.map((id) => ({ id, label: PHASE_LABELS[id] })),
];

function tripMeta(trip: Trip) {
  return [trip.destination, `${formatDateLabel(trip.startDate)} → ${formatDateLabel(trip.endDate)}`]
    .filter(Boolean)
    .join(' · ');
}

/** Highlighted card for trips happening now. */
function LiveTripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.liveCard, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.liveCover}>
        <Badge text={phaseLabel(trip.phase)} tone="success" dot />
      </View>
      <View style={styles.liveBody}>
        <Text style={styles.liveName} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={styles.liveMeta} numberOfLines={1}>
          {tripMeta(trip)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TripsHome() {
  const { user, profile } = useAuth();
  const { isWide } = useLayout();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [query, setQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');

  useEffect(() => {
    if (!user) return;
    return subscribeUserTrips(user.uid, setTrips);
  }, [user]);

  const adminTrips = useMemo(
    () => trips.filter((t) => user && t.adminUid === user.uid),
    [trips, user]
  );

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      const phase = normalizeTripPhase(trip.phase);
      if (phaseFilter !== 'all' && phase !== phaseFilter) return false;
      if (!q) return true;
      const haystack = [trip.name, trip.destination, trip.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [trips, query, phaseFilter]);

  const liveTrips = filteredTrips.filter((t) => normalizeTripPhase(t.phase) === 'in_progress');
  const otherTrips = filteredTrips.filter((t) => normalizeTripPhase(t.phase) !== 'in_progress');
  const liveCount = trips.filter((t) => normalizeTripPhase(t.phase) === 'in_progress').length;
  const hasActiveFilter = query.trim().length > 0 || phaseFilter !== 'all';
  const firstName = profile?.displayName?.split(' ')[0];
  const openTrip = (trip: Trip) => router.push(`/(app)/trip/${trip.id}`);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          title={firstName ? `Olá, ${firstName}` : 'Suas viagens'}
          subtitle={
            trips.length === 0
              ? 'Suas viagens em um só lugar'
              : `${trips.length} ${trips.length === 1 ? 'viagem' : 'viagens'}${
                  liveCount > 0 ? ` · ${liveCount} em andamento` : ''
                }`
          }
          actions={
            <Pressable
              onPress={() => logout()}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
              style={styles.account}
            >
              <Avatar name={profile?.displayName || '?'} size={32} />
              <Text style={styles.logout}>Sair</Text>
            </Pressable>
          }
        />

        <View style={[styles.actions, isWide && { maxWidth: 520 }]}>
          <View style={styles.actionItem}>
            <Button title="Nova viagem" icon="add" onPress={() => router.push('/(app)/trip/new')} />
          </View>
          <View style={styles.actionItem}>
            <Button
              title="Usar código"
              icon="log-in-outline"
              variant="secondary"
              onPress={() => router.push('/(app)/trip/join')}
            />
          </View>
        </View>

        {user
          ? adminTrips.map((trip) => (
              <TripPhasePromptBanner
                key={`prompt-${trip.id}`}
                trip={trip}
                adminUid={trip.adminUid}
                currentUid={user.uid}
              />
            ))
          : null}

        {trips.length > 0 ? (
          <View style={styles.filters}>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.inkSoft} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por nome ou destino"
                placeholderTextColor={colors.inkMuted}
                accessibilityLabel="Buscar viagens"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={styles.searchInput}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseRow}>
              {PHASE_FILTERS.map((item) => {
                const active = phaseFilter === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setPhaseFilter(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.id === 'all' ? `${item.label} · ${trips.length}` : item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {hasActiveFilter ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setPhaseFilter('all');
                }}
                hitSlop={8}
                style={{ alignSelf: 'flex-start' }}
              >
                <Text style={styles.clearFilters}>Limpar filtros</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {filteredTrips.length === 0 ? (
          <EmptyState
            title={trips.length === 0 ? 'Nenhuma viagem ainda' : 'Nenhuma viagem com esse filtro'}
            subtitle={
              trips.length === 0
                ? 'Crie uma viagem ou entre com um código de convite.'
                : 'Tente outro título ou status.'
            }
          />
        ) : null}

        {liveTrips.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Em andamento" />
            <View style={[styles.liveGrid, isWide && styles.liveGridWide]}>
              {liveTrips.map((trip) => (
                <View key={trip.id} style={isWide ? styles.liveItemWide : undefined}>
                  <LiveTripCard trip={trip} onPress={() => openTrip(trip)} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {otherTrips.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={liveTrips.length > 0 ? 'Outras viagens' : 'Viagens'} />
            <ListGroup>
              {otherTrips.map((trip) => {
                const phase = normalizeTripPhase(trip.phase);
                return (
                  <ListRow
                    key={trip.id}
                    title={trip.name}
                    subtitle={tripMeta(trip)}
                    trailing={<Badge text={phaseLabel(phase)} tone={phaseTone(phase)} />}
                    chevron
                    onPress={() => openTrip(trip)}
                  />
                );
              })}
            </ListGroup>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  logout: { color: colors.inkSoft, fontFamily: fonts.uiSemi, fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionItem: { flex: 1 },
  filters: { gap: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.ink,
  },
  phaseRow: { gap: 6 },
  chip: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkLabel },
  chipTextActive: { fontFamily: fonts.uiBold, color: colors.white },
  clearFilters: { color: colors.accent, fontFamily: fonts.uiBold, fontSize: 13 },
  section: { gap: spacing.sm },
  liveGrid: { gap: spacing.sm },
  liveGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  liveItemWide: { flexBasis: 320, flexGrow: 1 },
  liveCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  liveCover: {
    height: 72,
    backgroundColor: colors.accent,
    justifyContent: 'flex-end',
    padding: 12,
  },
  liveBody: { paddingHorizontal: spacing.md, paddingVertical: 12, gap: 2 },
  liveName: { fontFamily: fonts.uiBold, fontSize: 17, color: colors.ink },
  liveMeta: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkSoft },
});
