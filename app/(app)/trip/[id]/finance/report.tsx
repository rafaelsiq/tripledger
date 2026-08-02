import React, { useMemo, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Badge, Body, Button, Card, Label, Screen } from '@/src/components/ui';
import { SettlementList } from '@/src/components/finance/SettlementList';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { computeNetBalances, expenseTotals, simplifyDebts } from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  markSettlementSettled,
  saveSettlements,
  subscribeSettlements,
} from '@/src/services/expenses';
import type { Settlement } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

export default function FinanceReportScreen() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, expenses, members, isFinanceLead, isAdmin, canMutate } = useTrip();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trip) return;
    return subscribeSettlements(trip.id, setSettlements);
  }, [trip]);

  const report = useMemo(() => {
    const totals = expenseTotals(expenses);
    const billable = expenses.filter((e) => e.kind !== 'income');
    const byCategory: Record<string, number> = {};
    for (const e of billable) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }
    const nets = computeNetBalances(billable);
    const suggested = simplifyDebts(nets);
    return {
      totalActual: totals.actual,
      totalPlanned: totals.planned,
      byCategory,
      nets,
      suggested,
    };
  }, [expenses]);

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
            // User aborted the picker — still allow settling without proof.
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
        <Card style={{ gap: spacing.sm }}>
          <Label>Visão geral</Label>
          <Text style={styles.number}>{formatCurrency(report.totalActual)}</Text>
          <Body muted>
            Realizado na viagem · Previsto (planejamento):{' '}
            {formatCurrency(report.totalPlanned)}
          </Body>
          {report.totalPlanned > 0 ? (
            <Badge
              text={
                report.totalActual > report.totalPlanned
                  ? 'Realizado acima do previsto'
                  : 'Dentro do previsto'
              }
              tone={report.totalActual > report.totalPlanned ? 'warn' : 'success'}
            />
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Label>Por categoria</Label>
          {Object.entries(report.byCategory).map(([cat, value]) => (
            <View key={cat} style={styles.row}>
              <Text style={styles.rowLabel}>
                {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
              </Text>
              <Text style={styles.rowValue}>{formatCurrency(value)}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Label>Saldo por membro</Label>
          {members.map((m) => {
            const net = report.nets[m.uid] || 0;
            return (
              <View key={m.uid} style={styles.row}>
                <Text style={styles.rowLabel}>{m.displayName}</Text>
                <Text
                  style={[
                    styles.rowValue,
                    { color: net >= 0 ? colors.success : colors.danger },
                  ]}
                >
                  {net >= 0 ? '+' : ''}
                  {formatCurrency(net)}
                </Text>
              </View>
            );
          })}
          <Body muted>Positivo = a receber · Negativo = a pagar</Body>
        </Card>

        <Card style={{ gap: spacing.sm }}>
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

        <Card style={{ gap: spacing.sm }}>
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
  number: { ...typography.number },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: { color: colors.ink, fontWeight: '600' },
  rowValue: { color: colors.finance, fontWeight: '700' },
  suggest: { color: colors.ink, fontSize: 14, lineHeight: 20 },
});
