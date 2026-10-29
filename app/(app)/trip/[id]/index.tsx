import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Notice, PageHeader, Screen } from '@/src/components/ui';
import { BalanceCard } from '@/src/components/finance/BalanceCard';
import { PendingConsolidationCard } from '@/src/components/finance/PendingConsolidationCard';
import { InviteShareCard } from '@/src/components/InviteShareCard';
import { TripPhaseAdminActions } from '@/src/components/TripPhaseAdminActions';
import { TripClosedBanner, TripPhasePromptBanner } from '@/src/components/TripPhaseBanner';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { expenseTotals, memberBalance, paymentProgress } from '@/src/lib/finance';
import { formatDateLabel } from '@/src/lib/dates';
import { phaseLabel, phaseTone } from '@/src/lib/tripPhase';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

/** Compact BRL for KPI tiles: "R$ 14,2 mil" above 10k, full value otherwise. */
function compactCurrency(value: number) {
  if (Math.abs(value) >= 10000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return formatCurrency(value);
}

export default function TripSummaryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isWide } = useLayout();
  const {
    trip,
    expenses,
    payments,
    members,
    isAdmin,
    isFinanceLead,
    canMutate,
    phase,
  } = useTrip();

  const balance = useMemo(() => {
    if (!user) return null;
    return memberBalance(user.uid, expenses, payments);
  }, [user, expenses, payments]);

  const totals = useMemo(() => expenseTotals(expenses), [expenses]);
  const progress = useMemo(() => paymentProgress(expenses), [expenses]);

  if (!trip || !balance || !user) return null;

  const paidPct = progress.total > 0 ? Math.round((progress.paid / progress.total) * 100) : 0;
  const overBudget = totals.planned > 0 && totals.actual > totals.planned;
  const subtitle = [
    trip.destination,
    `${formatDateLabel(trip.startDate)} → ${formatDateLabel(trip.endDate)}`,
    `${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const balanceCard = (
    <BalanceCard
      status={balance.status}
      netOwed={balance.netOwed}
      pendingFromMe={balance.pendingFromMe}
      onOpenFinance={() => router.push(`/(app)/trip/${trip.id}/finance`)}
    />
  );

  const kpis = (
    <View style={styles.kpis}>
      <View style={styles.kpiRow}>
        <View style={[styles.kpi, styles.kpiDivider]}>
          <Text style={styles.kpiLabel}>Previsto</Text>
          <Text style={styles.kpiValue}>{compactCurrency(totals.planned)}</Text>
        </View>
        <View style={[styles.kpi, styles.kpiDivider]}>
          <Text style={styles.kpiLabel}>Realizado</Text>
          <Text style={[styles.kpiValue, overBudget && { color: colors.warn }]}>
            {compactCurrency(totals.actual)}
          </Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Quitado</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>{paidPct}%</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${paidPct}%` }]} />
      </View>
    </View>
  );

  const overBudgetNotice = overBudget ? (
    <Notice
      tone="warn"
      icon="trending-up-outline"
      title="Acima do previsto."
      message={`Realizado está ${formatCurrency(totals.actual - totals.planned)} acima do planejamento.`}
    />
  ) : null;

  const invite = isAdmin ? (
    <InviteShareCard tripName={trip.name} inviteCode={trip.inviteCode} isAdmin />
  ) : null;

  const adminActions = (
    <TripPhaseAdminActions trip={trip} adminUid={trip.adminUid} currentUid={user.uid} />
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          title={trip.name}
          subtitle={subtitle}
          eyebrow={<Badge text={phaseLabel(phase)} tone={phaseTone(phase)} dot />}
        />
        <TripPhasePromptBanner trip={trip} adminUid={trip.adminUid} currentUid={user.uid} />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <PendingConsolidationCard
          tripId={trip.id}
          currentUid={user.uid}
          isAdmin={isAdmin}
          isFinanceLead={isFinanceLead}
          canMutate={canMutate}
          payments={payments}
          expenses={expenses}
          members={members}
        />

        {isWide ? (
          <View style={styles.dashRow}>
            <View style={styles.dashCol}>
              {balanceCard}
              {kpis}
              {overBudgetNotice}
            </View>
            <View style={styles.dashCol}>
              {invite}
              {adminActions}
            </View>
          </View>
        ) : (
          <>
            {balanceCard}
            {kpis}
            {overBudgetNotice}
            {invite}
            {adminActions}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.xs },
  kpis: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 14,
  },
  kpiRow: { flexDirection: 'row' },
  kpi: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, gap: 2 },
  kpiDivider: { borderRightWidth: 1, borderRightColor: colors.divider },
  kpiLabel: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.inkSoft },
  kpiValue: {
    fontFamily: fonts.uiHeavy,
    fontSize: 16,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    marginHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent },
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
