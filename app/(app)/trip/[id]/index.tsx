import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Body, Card, Label, Screen } from '@/src/components/ui';
import { BalanceCard } from '@/src/components/finance/BalanceCard';
import { InviteShareCard } from '@/src/components/InviteShareCard';
import { TripPhaseAdminActions } from '@/src/components/TripPhaseAdminActions';
import { TripClosedBanner, TripPhasePromptBanner } from '@/src/components/TripPhaseBanner';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { expenseTotals, memberBalance } from '@/src/lib/finance';
import { formatDateLabel } from '@/src/lib/dates';
import { phaseLabel } from '@/src/lib/tripPhase';
import { colors, fonts, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

export default function TripSummaryScreen() {
  const { user } = useAuth();
  const { isWide } = useLayout();
  const { trip, expenses, payments, isAdmin, isFinanceLead, phase } = useTrip();

  const balance = useMemo(() => {
    if (!user) return null;
    return memberBalance(user.uid, expenses, payments);
  }, [user, expenses, payments]);

  const totals = useMemo(() => expenseTotals(expenses), [expenses]);

  if (!trip || !balance || !user) return null;

  const accounting = (
    <Card style={styles.stats}>
      <Label>Contabilidade</Label>
      <Body muted>Soma das despesas previstas e realizadas lançadas na viagem.</Body>
      <View style={styles.statRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statLabel}>Previsto</Text>
          <Text style={styles.statValue}>{formatCurrency(totals.planned)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statLabel}>Realizado</Text>
          <Text style={styles.statValue}>{formatCurrency(totals.actual)}</Text>
        </View>
      </View>
      {totals.planned > 0 && totals.actual > totals.planned ? (
        <Badge text="Atenção: realizado acima do previsto" tone="warn" />
      ) : null}
    </Card>
  );

  return (
    <Screen ambient>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Badge
            text={phaseLabel(phase)}
            tone={phase === 'closed' ? 'neutral' : phase === 'in_progress' ? 'success' : 'accent'}
          />
          <Text style={[styles.title, isWide && styles.titleWide]}>{trip.name}</Text>
          {trip.destination ? <Body muted>{trip.destination}</Body> : null}
          <Text style={styles.dates}>
            {formatDateLabel(trip.startDate)} → {formatDateLabel(trip.endDate)}
          </Text>
        </View>

        <TripPhasePromptBanner
          trip={trip}
          adminUid={trip.adminUid}
          currentUid={user.uid}
        />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        {isWide ? (
          <View style={styles.dashRow}>
            <View style={styles.dashCol}>
              <BalanceCard
                status={balance.status}
                netOwed={balance.netOwed}
                pendingFromMe={balance.pendingFromMe}
              />
              {accounting}
            </View>
            <View style={styles.dashCol}>
              {isAdmin ? (
                <InviteShareCard
                  tripName={trip.name}
                  inviteCode={trip.inviteCode}
                  isAdmin
                />
              ) : null}
              <TripPhaseAdminActions
                trip={trip}
                adminUid={trip.adminUid}
                currentUid={user.uid}
              />
            </View>
          </View>
        ) : (
          <>
            <BalanceCard
              status={balance.status}
              netOwed={balance.netOwed}
              pendingFromMe={balance.pendingFromMe}
            />
            {accounting}
            {isAdmin ? (
              <InviteShareCard
                tripName={trip.name}
                inviteCode={trip.inviteCode}
                isAdmin
              />
            ) : null}
            <TripPhaseAdminActions
              trip={trip}
              adminUid={trip.adminUid}
              currentUid={user.uid}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.xs },
  title: { ...typography.title, fontSize: 30 },
  titleWide: { fontSize: 36, letterSpacing: -0.6 },
  dates: { color: colors.inkMuted, marginTop: 4, fontFamily: fonts.ui },
  stats: { gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statLabel: { color: colors.inkSoft, fontSize: 13, fontFamily: fonts.ui },
  statValue: { ...typography.number, fontSize: 22 },
  dashRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  dashCol: {
    flex: 1,
    gap: spacing.md,
  },
});
