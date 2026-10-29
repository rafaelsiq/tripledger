import React, { useMemo, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  Badge,
  Button,
  Card,
  Notice,
  PageHeader,
  Screen,
  SectionHeader,
} from '@/src/components/ui';
import { SettlementList } from '@/src/components/finance/SettlementList';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import {
  computeNetBalances,
  expenseTotals,
  memberBalance,
  paymentProgress,
  simplifyDebts,
} from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  markSettlementSettled,
  saveSettlements,
  subscribeSettlements,
} from '@/src/services/expenses';
import type { Settlement } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'muted';
}) {
  const color =
    tone === 'success'
      ? colors.success
      : tone === 'danger'
        ? colors.danger
        : tone === 'muted'
          ? colors.inkSoft
          : colors.finance;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function FinanceReportScreen() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, expenses, payments, members, isFinanceLead, isAdmin, canMutate } = useTrip();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trip) return;
    return subscribeSettlements(trip.id, setSettlements);
  }, [trip]);

  const report = useMemo(() => {
    const totals = expenseTotals(expenses);
    const progress = paymentProgress(expenses);
    const byCategory: Record<string, { total: number; paid: number }> = {};
    for (const e of progress.billable) {
      const entry = byCategory[e.category] || { total: 0, paid: 0 };
      entry.total += e.amount;
      entry.paid += e.splits.reduce((s, sp) => s + sp.paidAmount, 0);
      byCategory[e.category] = entry;
    }
    const nets = computeNetBalances(progress.billable);
    const suggested = simplifyDebts(nets);
    const memberRows = members.map((m) => {
      const balance = memberBalance(m.uid, expenses, payments);
      return {
        member: m,
        ...balance,
        net: nets[m.uid] || 0,
      };
    });
    const paymentsConfirmed = payments
      .filter((p) => p.status === 'confirmed')
      .reduce((s, p) => s + p.amount, 0);
    const paymentsPending = payments
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => s + p.amount, 0);
    const paidPct =
      progress.total > 0 ? Math.round((progress.paid / progress.total) * 100) : 0;
    return {
      totals,
      progress,
      paidPct,
      byCategory,
      nets,
      suggested,
      memberRows,
      paymentsConfirmed: Math.round(paymentsConfirmed * 100) / 100,
      paymentsPending: Math.round(paymentsPending * 100) / 100,
    };
  }, [expenses, payments, members]);

  if (!trip || !user) return null;

  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  async function generateSettlements() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    try {
      setLoading(true);
      if (settlements.some((s) => s.status === 'open')) {
        showError('Já existem acertos em aberto.', 'Encerre os atuais primeiro');
        return;
      }
      await saveSettlements(trip!.id, report.suggested);
      showSuccess('Acerto gerado', 'Transferências mínimas criadas.');
    } catch (e) {
      showError(e, 'Falha ao gerar acerto');
    } finally {
      setLoading(false);
    }
  }

  async function settle(settlement: Settlement, proofUri?: string) {
    try {
      await markSettlementSettled(trip!.id, settlement.id, proofUri);
      showSuccess('Acerto quitado', proofUri ? 'Com comprovante.' : 'Sem comprovante.');
    } catch (e) {
      showError(e, 'Falha ao quitar acerto');
    }
  }

  function onSettle(settlement: Settlement) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    Alert.alert('Quitar acerto', 'Comprovante é opcional.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sem comprovante',
        onPress: () => settle(settlement),
      },
      {
        text: 'Anexar comprovante',
        onPress: async () => {
          const pick = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
          if (pick.canceled) {
            await settle(settlement);
            return;
          }
          await settle(settlement, pick.assets[0]?.uri);
        },
      },
    ]);
  }

  const peopleCount = Math.max(1, members.length);
  const perPerson = report.progress.total / peopleCount;
  const overBudget = report.totals.planned > 0 && report.totals.actual > report.totals.planned;
  const budgetDelta =
    report.totals.planned > 0
      ? Math.round(((report.totals.actual - report.totals.planned) / report.totals.planned) * 100)
      : 0;
  const categories = Object.entries(report.byCategory).sort((a, b) => b[1].total - a[1].total);
  const categoryMax = Math.max(1, ...categories.map(([, v]) => v.total));
  const settledCount = settlements.filter((s) => s.status === 'settled').length;
  const memberRows = report.memberRows.slice().sort((a, b) => b.net - a.net);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader title="Relatório" subtitle={trip.name} />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        <Card style={styles.card}>
          <View style={styles.totalRow}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Text style={styles.caption}>Custo total</Text>
              <Text style={styles.number}>{formatCurrency(report.progress.total)}</Text>
            </View>
            {report.totals.planned > 0 ? (
              <Badge
                text={
                  overBudget
                    ? `${budgetDelta}% acima do previsto`
                    : `${Math.abs(budgetDelta)}% abaixo do previsto`
                }
                tone={overBudget ? 'warn' : 'success'}
              />
            ) : null}
          </View>
          <View style={styles.kpis}>
            <Kpi label="Por pessoa" value={formatCurrency(perPerson)} />
            <Kpi label="Pago" value={formatCurrency(report.progress.paid)} color={colors.success} />
            <Kpi
              label="Em aberto"
              value={formatCurrency(report.progress.open)}
              color={report.progress.open > 0.01 ? colors.danger : colors.success}
            />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${report.paidPct}%` }]} />
          </View>
          <View style={styles.subRows}>
            <StatRow label="Previsto (planejamento)" value={formatCurrency(report.totals.planned)} />
            <StatRow label="Realizado" value={formatCurrency(report.totals.actual)} />
            {report.totals.income > 0 ? (
              <StatRow label="Receitas" value={formatCurrency(report.totals.income)} tone="success" />
            ) : null}
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Por categoria" />
          <Card style={styles.card}>
            {categories.length === 0 ? (
              <Text style={styles.muted}>Sem despesas ainda.</Text>
            ) : (
              categories.map(([cat, value]) => {
                const share =
                  report.progress.total > 0 ? Math.round((value.total / report.progress.total) * 100) : 0;
                const open = Math.max(0, Math.round((value.total - value.paid) * 100) / 100);
                return (
                  <View key={cat} style={styles.categoryBlock}>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>
                        {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
                      </Text>
                      <Text style={styles.rowValue}>
                        {formatCurrency(value.total)} <Text style={styles.share}>{share}%</Text>
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(value.total / categoryMax) * 100}%` }]} />
                    </View>
                    {open > 0.01 ? (
                      <Text style={styles.categoryMeta}>Em aberto {formatCurrency(open)}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Saldo por pessoa" />
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.th, styles.colName]}>Pessoa</Text>
              <Text style={[styles.th, styles.colNum]}>Deve</Text>
              <Text style={[styles.th, styles.colNum]}>Pagou</Text>
              <Text style={[styles.th, styles.colNum]}>Saldo</Text>
            </View>
            {memberRows.map((row) => (
              <View key={row.member.uid} style={styles.tableRow}>
                <Text style={[styles.td, styles.colName, styles.tdName]} numberOfLines={1}>
                  {row.member.uid === user.uid ? 'Você' : memberLabel(row.member)}
                </Text>
                <Text style={[styles.td, styles.colNum]}>{formatCurrency(row.owed)}</Text>
                <Text style={[styles.td, styles.colNum]}>{formatCurrency(row.paid)}</Text>
                <Text
                  style={[
                    styles.td,
                    styles.colNum,
                    styles.tdStrong,
                    { color: row.net >= 0 ? colors.success : colors.danger },
                  ]}
                >
                  {`${row.net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(row.net))}`}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footnote}>
            Saldo = quanto cada pessoa adiantou menos o que deve no rateio. Positivo = a receber.
          </Text>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={
              settlements.length > 0
                ? `Acertos · ${settlements.length} ${settlements.length === 1 ? 'transferência' : 'transferências'}`
                : 'Acerto sugerido'
            }
            trailing={settlements.length > 0 ? `${settledCount} de ${settlements.length} quitado` : undefined}
          />
          {settlements.length > 0 ? (
            <SettlementList
              settlements={settlements}
              members={members}
              currentUid={user.uid}
              canManage={(isFinanceLead || isAdmin) && canMutate}
              onSettle={onSettle}
            />
          ) : report.suggested.length === 0 ? (
            <Notice
              tone="success"
              icon="checkmark-circle-outline"
              message="Contas equilibradas — ninguém deve a ninguém."
            />
          ) : (
            <Card style={styles.card}>
              {report.suggested.map((s, idx) => (
                <View key={idx} style={styles.row}>
                  <Text style={styles.suggest}>
                    <Text style={styles.suggestName}>{nameOf(s.fromUid)}</Text>
                    {'  →  '}
                    <Text style={styles.suggestName}>{nameOf(s.toUid)}</Text>
                  </Text>
                  <Text style={styles.rowValue}>{formatCurrency(s.amount)}</Text>
                </View>
              ))}
              {(isFinanceLead || isAdmin) && canMutate ? (
                <Button
                  title="Gerar acerto de contas"
                  icon="git-compare-outline"
                  onPress={generateSettlements}
                  loading={loading}
                />
              ) : (
                <Text style={styles.muted}>
                  O responsável financeiro gera o acerto quando a viagem fechar.
                </Text>
              )}
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Pagamentos registrados" />
          <Card style={styles.card}>
            <StatRow
              label="Confirmados"
              value={formatCurrency(report.paymentsConfirmed)}
              tone="success"
            />
            <StatRow
              label="Aguardando confirmação"
              value={formatCurrency(report.paymentsPending)}
              tone={report.paymentsPending > 0 ? 'danger' : 'muted'}
            />
            <Text style={styles.footnote}>
              Valores enviados pelos membros. Podem diferir do “Pago” se houver rateios marcados como
              pagos na criação.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  card: { gap: 12 },
  caption: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkSoft },
  muted: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkSoft },
  number: { ...typography.number },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  kpis: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
    gap: spacing.sm,
  },
  kpi: { flex: 1, gap: 2 },
  kpiLabel: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.inkSoft },
  kpiValue: {
    fontFamily: fonts.uiHeavy,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  subRows: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: spacing.sm,
  },
  rowLabel: { color: colors.ink, fontFamily: fonts.uiSemi, fontSize: 14, flex: 1 },
  rowValue: {
    color: colors.ink,
    fontFamily: fonts.uiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  share: { fontFamily: fonts.uiSemi, color: colors.inkSoft },
  categoryBlock: { gap: 6 },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  categoryMeta: { color: colors.inkSoft, fontSize: 12, fontFamily: fonts.ui },
  table: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  tableHead: { borderTopWidth: 0, paddingVertical: 9 },
  th: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.inkSoft },
  td: { fontFamily: fonts.ui, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  tdName: { fontFamily: fonts.uiSemi, fontSize: 14 },
  tdStrong: { fontFamily: fonts.uiBold },
  colName: { flex: 1.3 },
  colNum: { flex: 1, textAlign: 'right' },
  footnote: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  suggest: { flex: 1, color: colors.ink, fontSize: 14, fontFamily: fonts.ui },
  suggestName: { fontFamily: fonts.uiBold },
});
