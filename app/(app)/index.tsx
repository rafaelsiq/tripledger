import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TripPhasePromptBanner } from '@/src/components/TripPhaseBanner';
import { Badge, Button, Card, EmptyState, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { formatDateLabel } from '@/src/lib/dates';
import { normalizeTripPhase, phaseLabel } from '@/src/lib/tripPhase';
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

function TripRow({
  item,
  index,
  onPress,
}: {
  item: Trip;
  index: number;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const phase = normalizeTripPhase(item.phase);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable onPress={onPress}>
        <Card style={styles.tripCard}>
          <View style={styles.tripTop}>
            <Text style={styles.tripName}>{item.name}</Text>
            <Badge
              text={phaseLabel(phase)}
              tone={phase === 'closed' ? 'neutral' : phase === 'in_progress' ? 'success' : 'accent'}
            />
          </View>
          {item.destination ? <Text style={styles.dest}>{item.destination}</Text> : null}
          <Text style={styles.dates}>
            {formatDateLabel(item.startDate)} → {formatDateLabel(item.endDate)}
          </Text>
        </Card>
      </Pressable>
    </Animated.View>
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

  const hasActiveFilter = query.trim().length > 0 || phaseFilter !== 'all';

  return (
    <Screen ambient style={{ paddingTop: spacing.sm }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Olá, {profile?.displayName?.split(' ')[0]}</Text>
          <Text style={styles.sub}>Suas viagens em um só lugar</Text>
        </View>
        <Pressable onPress={() => logout()}>
          <Text style={styles.logout}>Sair</Text>
        </Pressable>
      </View>

      <View style={[styles.actions, isWide && styles.actionsWide]}>
        <View style={isWide ? styles.actionItem : undefined}>
          <Button title="Criar viagem" onPress={() => router.push('/(app)/trip/new')} />
        </View>
        <View style={isWide ? styles.actionItem : undefined}>
          <Button
            title="Entrar com código"
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
              compact
            />
          ))
        : null}

      {trips.length > 0 ? (
        <View style={styles.filters}>
          <Input
            label="Buscar"
            value={query}
            onChangeText={setQuery}
            placeholder="Título, destino…"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <View style={styles.phaseRow}>
            {PHASE_FILTERS.map((item) => {
              const active = phaseFilter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setPhaseFilter(item.id)}
                  style={({ pressed }) => [
                    styles.phaseChip,
                    active && styles.phaseChipActive,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text style={[styles.phaseChipText, active && styles.phaseChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {hasActiveFilter ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setPhaseFilter('all');
              }}
              hitSlop={8}
            >
              <Text style={styles.clearFilters}>Limpar filtros</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlatList
        style={styles.list}
        data={filteredTrips}
        key={isWide ? 'trips-grid' : 'trips-list'}
        keyExtractor={(item) => item.id}
        numColumns={isWide ? 2 : 1}
        columnWrapperStyle={isWide ? styles.gridRow : undefined}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <EmptyState
            title={
              trips.length === 0
                ? 'Nenhuma viagem ainda'
                : 'Nenhuma viagem com esse filtro'
            }
            subtitle={
              trips.length === 0
                ? 'Crie uma viagem ou entre com um código de convite.'
                : 'Tente outro título ou status.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <View style={isWide ? styles.gridItem : undefined}>
            <TripRow
              item={item}
              index={index}
              onPress={() => router.push(`/(app)/trip/${item.id}`)}
            />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  hello: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  sub: {
    color: colors.inkSoft,
    marginTop: 4,
    fontFamily: fonts.ui,
  },
  logout: {
    color: colors.inkMuted,
    fontFamily: fonts.uiSemi,
  },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  actionsWide: { flexDirection: 'row' },
  actionItem: { flex: 1 },
  filters: { gap: spacing.sm, marginBottom: spacing.lg },
  phaseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phaseChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  phaseChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  phaseChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.inkSoft,
  },
  phaseChipTextActive: {
    color: colors.accentDark,
  },
  clearFilters: {
    alignSelf: 'flex-start',
    color: colors.inkMuted,
    fontFamily: fonts.uiSemi,
    fontSize: 13,
  },
  list: { flex: 1 },
  gridRow: { gap: spacing.md },
  gridItem: { flex: 1 },
  tripCard: { gap: spacing.xs },
  tripTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripName: {
    fontSize: 18,
    fontFamily: fonts.uiBold,
    color: colors.ink,
    flex: 1,
  },
  dest: { color: colors.inkSoft, fontFamily: fonts.ui },
  dates: {
    color: colors.inkMuted,
    fontSize: 13,
    marginTop: 4,
    fontFamily: fonts.ui,
  },
});
