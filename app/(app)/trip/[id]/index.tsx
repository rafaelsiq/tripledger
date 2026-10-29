import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  Screen,
  SectionHeader,
} from '@/src/components/ui';
import { todayValue } from '@/src/lib/dates';
import { itemKind, sortItemsByTime } from '@/src/lib/itineraryStory';
import { countVotes, subscribeDayItems, subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay, ItineraryItem } from '@/src/types';
import { BalanceCard } from '@/src/components/finance/BalanceCard';
import { PendingConsolidationCard } from '@/src/components/finance/PendingConsolidationCard';
import { InviteShareCard } from '@/src/components/InviteShareCard';
import { TripPhaseAdminActions } from '@/src/components/TripPhaseAdminActions';
import { TripClosedBanner, TripPhasePromptBanner } from '@/src/components/TripPhaseBanner';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import {
  computeLedgerBalances,
  expenseTotals,
  fundSummary,
  memberBalance,
  paymentProgress,
} from '@/src/lib/finance';
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
    settlements,
    funds,
    fundMovements,
    members,
    isAdmin,
    isFinanceLead,
    canMutate,
    phase,
  } = useTrip();

  const balance = useMemo(() => {
    if (!user) return null;
    const ledger = computeLedgerBalances({ expenses, payments, settlements, fundMovements });
    const fundBalance = funds.reduce((sum, fund) => {
      const mine = fundSummary(fund, fundMovements, expenses).members.find(
        (m) => m.uid === user.uid
      );
      return sum + (mine?.balance || 0);
    }, 0);
    return {
      ...memberBalance(user.uid, expenses, payments),
      net: ledger[user.uid] || 0,
      fundBalance: funds.length ? fundBalance : undefined,
    };
  }, [user, expenses, payments, settlements, funds, fundMovements]);

  const totals = useMemo(() => expenseTotals(expenses), [expenses]);
  const progress = useMemo(() => paymentProgress(expenses), [expenses]);

  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [todayItems, setTodayItems] = useState<ItineraryItem[]>([]);
  const today = todayValue();
  const todayDay = days.find((d) => d.date === today) ?? null;
  const todayIndex = todayDay ? days.indexOf(todayDay) : -1;
  const tripId = trip?.id;
  const todayDayId = todayDay?.id;

  useEffect(() => {
    if (!tripId) return;
    return subscribeItineraryDays(tripId, setDays);
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !todayDayId) {
      setTodayItems([]);
      return;
    }
    return subscribeDayItems(tripId, todayDayId, (items) => setTodayItems(sortItemsByTime(items)));
  }, [tripId, todayDayId]);

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
      net={balance.net}
      pendingFromMe={balance.pendingFromMe}
      fundBalance={balance.fundBalance}
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

  const todaySection = todayDay ? (
    <View style={styles.section}>
      <SectionHeader
        title={`Hoje · Dia ${todayIndex + 1}`}
        trailing="Roteiro"
        onTrailingPress={() => router.push(`/(app)/trip/${trip.id}/itinerary`)}
      />
      {todayItems.length === 0 ? (
        <ListGroup>
          <ListRow title="Dia livre" subtitle="Nenhuma atividade programada para hoje." />
        </ListGroup>
      ) : (
        <ListGroup>
          {todayItems.slice(0, 4).map((item) => {
            const counts = countVotes(item);
            const myVote = item.votes?.[user.uid];
            const rest = itemKind(item) === 'rest';
            return (
              <ListRow
                key={item.id}
                leading={<Text style={styles.time}>{item.time?.trim() || '—'}</Text>}
                title={item.title}
                subtitle={
                  rest
                    ? 'Descanso'
                    : !myVote
                      ? 'Falta seu voto'
                      : `${counts.yes} topam · ${counts.maybe} talvez`
                }
                chevron
                onPress={() =>
                  router.push({
                    pathname: `/(app)/trip/${trip.id}/itinerary/item/[itemId]` as never,
                    params: { itemId: item.id, dayId: item.dayId },
                  })
                }
              />
            );
          })}
        </ListGroup>
      )}
    </View>
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
              {todaySection}
              {invite}
              {adminActions}
            </View>
          </View>
        ) : (
          <>
            {balanceCard}
            {kpis}
            {overBudgetNotice}
            {todaySection}
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
  section: { gap: spacing.sm },
  time: {
    width: 44,
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
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
