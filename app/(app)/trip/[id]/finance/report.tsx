import React, { useMemo, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Badge, Body, Button, Card, Label, Screen } from '@/src/components/ui';
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        <Card style={styles.card}>
          <Label>Totais da viagem</Label>
          <Text style={styles.number}>{formatCurrency(report.progress.total)}</Text>
          <Body muted>Total das despesas (previsto + realizado, sem receitas)</Body>

          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statCaption}>Pago</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {formatCurrency(report.progress.paid)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statCaption}>Em aberto</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: report.progress.open > 0.01 ? colors.danger : colors.success,
                  },
                ]}
              >
                {formatCurrency(report.progress.open)}
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${report.paidPct}%` }]} />
          </View>
          <Text style={styles.progressCaption}>{report.paidPct}% quitado</Text>

          <StatRow label="Previsto (planejamento)" value={formatCurrency(report.totals.planned)} />
          <StatRow label="Realizado" value={formatCurrency(report.totals.actual)} />
          {report.totals.income > 0 ? (
            <StatRow label="Receitas" value={formatCurrency(report.totals.income)} tone="success" />
          ) : null}

          {report.totals.planned > 0 ? (
            <Badge
              text={
                report.totals.actual > report.totals.planned
                  ? 'Realizado acima do previsto'
                  : 'Dentro do previsto'
              }
              tone={report.totals.actual > report.totals.planned ? 'warn' : 'success'}
            />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Label>Pagamentos registrados</Label>
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
          <Body muted>
            Valores enviados pelos membros (comprovantes). Podem diferir um pouco do “Pago” acima
            se houver rateios já marcados como pagos na criação.
          </Body>
        </Card>

        <Card style={styles.card}>
          <Label>Por categoria</Label>
          {Object.keys(report.byCategory).length === 0 ? (
            <Body muted>Sem despesas ainda.</Body>
          ) : (
            Object.entries(report.byCategory).map(([cat, value]) => {
              const open = Math.max(0, Math.round((value.total - value.paid) * 100) / 100);
              return (
                <View key={cat} style={styles.categoryBlock}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
                    </Text>
                    <Text style={styles.rowValue}>{formatCurrency(value.total)}</Text>
                  </View>
                  <Text style={styles.categoryMeta}>
                    Pago {formatCurrency(value.paid)} · Em aberto {formatCurrency(open)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        <Card style={styles.card}>
          <Label>Por membro</Label>
          {report.memberRows.map((row) => (
            <View key={row.member.uid} style={styles.memberBlock}>
              <Text style={styles.memberName}>{memberLabel(row.member)}</Text>
              <StatRow label="Deve (rateio)" value={formatCurrency(row.owed)} />
              <StatRow label="Já pagou" value={formatCurrency(row.paid)} tone="success" />
              <StatRow
                label="Em aberto"
                value={formatCurrency(row.netOwed)}
                tone={row.netOwed > 0.01 ? 'danger' : 'success'}
              />
              <StatRow
                label="Saldo líquido (acerto)"
                value={`${row.net >= 0 ? '+' : ''}${formatCurrency(row.net)}`}
                tone={row.net >= 0 ? 'success' : 'danger'}
              />
            </View>
          ))}
          <Body muted>
            Em aberto = quanto falta pagar do rateio. Saldo líquido = quem adiantou vs quem deve no
            acerto final (positivo = a receber).
          </Body>
        </Card>

        <Card style={styles.card}>
          <Label>Simplificação de dívidas</Label>
          {report.suggested.length === 0 ? (
            <Body muted>Contas equilibradas — ninguém deve a ninguém.</Body>
          ) : (
            report.suggested.map((s, idx) => (
              <Text key={idx} style={styles.suggest}>
                {nameOf(s.fromUid)} deve {formatCurrency(s.amount)} a {nameOf(s.toUid)}
              </Text>
            ))
          )}
          {(isFinanceLead || isAdmin) && canMutate && report.suggested.length > 0 ? (
            <Button
              title="Gerar acerto de contas"
              variant="finance"
              onPress={generateSettlements}
              loading={loading}
            />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Label>Checklist de acertos</Label>
          <SettlementList
            settlements={settlements}
            members={members}
            currentUid={user.uid}
            canManage={(isFinanceLead || isAdmin) && canMutate}
            onSettle={onSettle}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  number: { ...typography.number },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: spacing.sm,
  },
  rowLabel: { color: colors.ink, fontFamily: fonts.uiSemi, flex: 1 },
  rowValue: { color: colors.finance, fontFamily: fonts.uiBold },
  statGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  statCell: {
    flex: 1,
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: spacing.sm,
  },
  statCaption: {
    color: colors.inkSoft,
    fontSize: 12,
    fontFamily: fonts.uiSemi,
  },
  statValue: {
    fontSize: 18,
    fontFamily: fonts.uiBold,
    color: colors.ink,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  progressCaption: {
    color: colors.inkMuted,
    fontSize: 12,
    fontFamily: fonts.uiSemi,
  },
  categoryBlock: {
    gap: 2,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  categoryMeta: {
    color: colors.inkMuted,
    fontSize: 12,
    fontFamily: fonts.ui,
  },
  memberBlock: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberName: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  suggest: { color: colors.ink, fontSize: 14, lineHeight: 20, fontFamily: fonts.ui },
});
