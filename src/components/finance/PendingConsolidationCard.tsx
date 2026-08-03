import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, Card, Label } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { memberLabel } from '@/src/lib/members';
import { confirmPayment, rejectPayment } from '@/src/services/expenses';
import type { Expense, Payment, TripMember } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

type Props = {
  tripId: string;
  currentUid: string;
  isAdmin: boolean;
  isFinanceLead: boolean;
  canMutate: boolean;
  payments: Payment[];
  expenses: Expense[];
  members: TripMember[];
};

/** Queue of registered payments awaiting consolidation — admin & finance lead. */
export function PendingConsolidationCard({
  tripId,
  currentUid,
  isAdmin,
  isFinanceLead,
  canMutate,
  payments,
  expenses,
  members,
}: Props) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'pending')
        .slice()
        .sort((a, b) => b.paidAt - a.paidAt),
    [payments]
  );

  if (!isAdmin && !isFinanceLead) return null;
  if (!pending.length) return null;

  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  const expenseOf = (expenseId: string) => expenses.find((e) => e.id === expenseId);

  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);

  async function onConfirm(payment: Payment) {
    const expense = expenseOf(payment.expenseId);
    if (!expense) {
      showError('Lançamento não encontrado.', 'Consolidação');
      return;
    }
    try {
      setBusyId(payment.id);
      await confirmPayment({
        tripId,
        payment,
        confirmedByUid: currentUid,
        expense,
      });
      showSuccess('Pagamento consolidado');
    } catch (e) {
      showError(e, 'Falha ao consolidar');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(payment: Payment) {
    try {
      setBusyId(payment.id);
      await rejectPayment(tripId, payment.id);
      showSuccess('Pagamento rejeitado');
    } catch (e) {
      showError(e, 'Falha ao rejeitar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Label>Pagamentos a consolidar</Label>
        <Text style={styles.count}>
          {pending.length} · {formatCurrency(totalPending)}
        </Text>
      </View>
      <Body muted>
        Pagamentos registrados que ainda precisam da sua confirmação.
      </Body>

      <View style={styles.list}>
        {pending.map((payment) => {
          const expense = expenseOf(payment.expenseId);
          const busy = busyId === payment.id;
          return (
            <View key={payment.id} style={styles.item}>
              <Pressable
                onPress={() =>
                  router.push(
                    `/(app)/trip/${tripId}/finance/expense/${payment.expenseId}`
                  )
                }
                style={({ pressed }) => [styles.itemMain, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.expenseTitle}>
                  {expense?.title || 'Lançamento'}
                </Text>
                <Text style={styles.itemMeta}>
                  {nameOf(payment.fromUid)} enviou {formatCurrency(payment.amount)}
                  {payment.proofUrl ? ' · com comprovante' : ' · sem comprovante'}
                </Text>
              </Pressable>
              {canMutate ? (
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Confirmar"
                      variant="finance"
                      onPress={() => onConfirm(payment)}
                      loading={busy}
                      disabled={!!busyId && !busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Rejeitar"
                      variant="danger"
                      onPress={() => onReject(payment)}
                      loading={busy}
                      disabled={!!busyId && !busy}
                    />
                  </View>
                </View>
              ) : (
                <Body muted>Viagem concluída: abra o lançamento para revisar.</Body>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderColor: colors.warn,
    backgroundColor: colors.warnSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  count: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.warn,
  },
  list: { gap: spacing.md, marginTop: spacing.xs },
  item: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(161, 92, 7, 0.25)',
  },
  itemMain: { gap: 4 },
  expenseTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
  },
  itemMeta: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
