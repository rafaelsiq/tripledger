import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { logout } from '@/src/services/auth';
import { subscribeUserTrips } from '@/src/services/trips';
import type { Trip } from '@/src/types';
import { PHASE_LABELS } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

export default function TripsHome() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeUserTrips(user.uid, setTrips);
  }, [user]);

  return (
    <Screen style={{ paddingTop: spacing.sm }}>
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
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/trip/${item.id}`)}>
            <Card style={styles.tripCard}>
              <View style={styles.tripTop}>
                <Text style={styles.tripName}>{item.name}</Text>
                <Badge text={PHASE_LABELS[item.phase]} tone="accent" />
              </View>
              {item.destination ? (
                <Text style={styles.dest}>{item.destination}</Text>
              ) : null}
              <Text style={styles.dates}>
                {item.startDate} → {item.endDate}
              </Text>
            </Card>
          </Pressable>
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
  hello: { ...typography.title },
  sub: { color: colors.inkSoft, marginTop: 4 },
  logout: { color: colors.inkMuted, fontWeight: '600' },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  tripCard: { gap: spacing.xs },
  tripTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripName: { fontSize: 18, fontWeight: '700', color: colors.ink, flex: 1 },
  dest: { color: colors.inkSoft },
  dates: { color: colors.inkMuted, fontSize: 13, marginTop: 4 },
});
