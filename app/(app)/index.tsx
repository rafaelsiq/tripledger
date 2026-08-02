import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TripPhasePromptBanner } from '@/src/components/TripPhaseBanner';
import { Badge, Button, Card, EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { formatDateLabel } from '@/src/lib/dates';
import { normalizeTripPhase, phaseLabel } from '@/src/lib/tripPhase';
import { logout } from '@/src/services/auth';
import { subscribeUserTrips } from '@/src/services/trips';
import type { Trip } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

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
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeUserTrips(user.uid, setTrips);
  }, [user]);

  const adminTrips = useMemo(
    () => trips.filter((t) => user && t.adminUid === user.uid),
    [trips, user]
  );

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

      <View style={styles.actions}>
        <Button title="Criar viagem" onPress={() => router.push('/(app)/trip/new')} />
        <Button
          title="Entrar com código"
          variant="secondary"
          onPress={() => router.push('/(app)/trip/join')}
        />
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

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma viagem ainda"
            subtitle="Crie uma viagem ou entre com um código de convite."
          />
        }
        renderItem={({ item, index }) => (
          <TripRow
            item={item}
            index={index}
            onPress={() => router.push(`/(app)/trip/${item.id}`)}
          />
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
