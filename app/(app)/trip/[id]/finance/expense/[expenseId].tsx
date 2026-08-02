import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  Badge,
  Body,
  Button,
  Card,
  Input,
  Label,
  Screen,
} from '@/src/components/ui';
import { PaymentTimeline } from '@/src/components/finance/PaymentTimeline';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  confirmPayment,
  registerPayment,
  rejectPayment,
  requestConsolidation,
  subscribeConsolidationRequests,
} from '@/src/services/expenses';
import type { ConsolidationRequest } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

export default function ExpenseDetailScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, expenses, payments, members, isFinanceLead, isAdmin, canMutate } = useTrip();
  const [amount, setAmount] = useState('');
  const [proxyUid, setProxyUid] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [reqs, setReqs] = useState<ConsolidationRequest[]>([]);

  const expense = expenses.find((e) => e.id === expenseId);
  const expensePayments = payments.filter((p) => p.expenseId === expenseId);
  const canManageFinance = isAdmin || isFinanceLead;

  React.useEffect(() => {
    if (!trip) return;
    return subscribeConsolidationRequests(trip.id, setReqs);
  }, [trip]);

  const mySplit = useMemo(
    () => expense?.splits.find((s) => s.uid === user?.uid),
    [expense, user]
  );

  const unpaidManagedSplits = useMemo(() => {
    if (!expense || !canManageFinance) return [];
    return expense.splits.filter(
      (s) => s.status !== 'paid' && s.uid !== expense.paidByUid
    );
  }, [expense, canManageFinance]);

  if (!trip || !expense || !user) return null;

  const currentTrip = trip;
  const currentExpense = expense;
  const currentUser = user;

  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  const paidTotal = currentExpense.splits.reduce((s, sp) => s + sp.paidAmount, 0);

  async function registerFor(fromUid: string, owedLeft: number) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const value = Number(String(amount).replace(',', '.')) || owedLeft;
    if (value <= 0) {
      showError('Informe um valor válido.', 'Pagamento');
      return;
    }
    try {
      setLoading(true);
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      const proofUri = pick.canceled ? undefined : pick.assets[0]?.uri;
      await registerPayment({
        tripId: currentTrip.id,
        expenseId: currentExpense.id,
        fromUid,
        toUid: currentExpense.paidByUid,
        amount: value,
        proofUri,
      });
      setAmount('');
      showSuccess('Pagamento registrado', 'Aguardando consolidação.');
    } catch (e) {
      showError(e, 'Falha ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  }

  async function onPay() {
    if (!mySplit) return;
    await registerFor(currentUser.uid, mySplit.amount - mySplit.paidAmount);
  }

  async function onProxyPay() {
    const targetUid = proxyUid || unpaidManagedSplits[0]?.uid;
    const split = unpaidManagedSplits.find((s) => s.uid === targetUid);
    if (!split) {
      showError('Selecione quem está pagando.', 'Pagamento');
      return;
    }
    await registerFor(split.uid, split.amount - split.paidAmount);
  }

  async function onConfirm(paymentId: string) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const payment = expensePayments.find((p) => p.id === paymentId);
    if (!payment) return;
    try {
      await confirmPayment({
        tripId: currentTrip.id,
        payment,
        confirmedByUid: currentUser.uid,
        expense: currentExpense,
      });
      showSuccess('Pagamento consolidado');
    } catch (e) {
      showError(e, 'Falha ao consolidar');
    }
  }

  async function onRequestConsolidation(paymentId: string) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const payment = expensePayments.find((p) => p.id === paymentId);
    if (!payment) return;
    try {
      await requestConsolidation({
        tripId: currentTrip.id,
        paymentId,
        fromUid: currentUser.uid,
        toUid: payment.toUid,
      });
      showSuccess('Solicitação enviada', 'O responsável financeiro pode consolidar.');
    } catch (e) {
      showError(e, 'Falha na solicitação');
    }
  }

  const pendingForMe = expensePayments.filter(
    (p) => p.status === 'pending' && (p.toUid === currentUser.uid || isFinanceLead)
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <View style={{ gap: 4 }}>
          <Text style={styles.title}>{expense.title}</Text>
          <Body muted>
            {CATEGORY_LABELS[expense.category]} · pago por {nameOf(expense.paidByUid)}
          </Body>
        </View>

        <Card>
          <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
          <PaymentTimeline
            total={expense.amount}
            paid={paidTotal}
            payments={expensePayments}
            members={members}
          />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Label>Divisão</Label>
          {expense.splits.map((s) => (
            <View key={s.uid} style={styles.splitRow}>
              <Text style={styles.splitName}>{nameOf(s.uid)}</Text>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.splitValue}>
                  {formatCurrency(s.paidAmount)} / {formatCurrency(s.amount)}
                </Text>
                <Badge
                  text={s.status === 'paid' ? 'Pago' : s.status === 'partial' ? 'Parcial' : 'Pendente'}
                  tone={s.status === 'paid' ? 'success' : s.status === 'partial' ? 'warn' : 'danger'}
                />
              </View>
            </View>
          ))}
        </Card>

        {canMutate &&
        mySplit &&
        mySplit.status !== 'paid' &&
        mySplit.uid !== expense.paidByUid ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Registrar meu pagamento</Label>
            <Input
              label="Valor"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder={String(mySplit.amount - mySplit.paidAmount)}
            />
            <Button
              title="Pagar com comprovante"
              variant="finance"
              onPress={onPay}
              loading={loading}
            />
          </Card>
        ) : null}

        {canMutate && canManageFinance && unpaidManagedSplits.length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Registrar pagamento por alguém</Label>
            <Body muted>
              Útil para placeholders ou quando o admin/financeiro registra em nome do membro.
            </Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {unpaidManagedSplits.map((s) => {
                const member = members.find((m) => m.uid === s.uid);
                const selected = (proxyUid || unpaidManagedSplits[0]?.uid) === s.uid;
                return (
                  <Button
                    key={s.uid}
                    title={member ? memberLabel(member) : nameOf(s.uid)}
                    variant={selected ? 'finance' : 'secondary'}
                    onPress={() => setProxyUid(s.uid)}
                  />
                );
              })}
            </View>
            <Input
              label="Valor"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder={String(
                (() => {
                  const uid = proxyUid || unpaidManagedSplits[0]?.uid;
                  const split = unpaidManagedSplits.find((s) => s.uid === uid);
                  return split ? split.amount - split.paidAmount : 0;
                })()
              )}
            />
            <Button
              title="Registrar pagamento"
              variant="finance"
              onPress={onProxyPay}
              loading={loading}
            />
          </Card>
        ) : null}

        {canMutate && pendingForMe.length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Consolidar pagamentos</Label>
            {pendingForMe.map((p) => (
              <View key={p.id} style={{ gap: spacing.sm }}>
                <Text>
                  {nameOf(p.fromUid)} enviou {formatCurrency(p.amount)}
                  {p.proofUrl ? ' (com comprovante)' : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Confirmar" variant="finance" onPress={() => onConfirm(p.id)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Rejeitar"
                      variant="danger"
                      onPress={async () => {
                        try {
                          await rejectPayment(trip.id, p.id);
                          showSuccess('Pagamento rejeitado');
                        } catch (e) {
                          showError(e, 'Falha ao rejeitar');
                        }
                      }}
                    />
                  </View>
                </View>
                {p.fromUid === user.uid ? (
                  <Button
                    title="Pedir consolidação ao resp. financeiro"
                    variant="secondary"
                    onPress={() => onRequestConsolidation(p.id)}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {isFinanceLead &&
        reqs.filter((r) => r.status === 'pending').length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Solicitações de consolidação</Label>
            {reqs
              .filter((r) => r.status === 'pending')
              .map((r) => {
                const payment = payments.find((p) => p.id === r.paymentId);
                if (!payment || payment.expenseId !== expense.id) return null;
                return (
                  <Button
                    key={r.id}
                    title={`Confirmar ${nameOf(r.fromUid)} · ${formatCurrency(payment.amount)}`}
                    variant="finance"
                    onPress={() => onConfirm(payment.id)}
                  />
                );
              })}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  amount: { fontSize: 28, fontWeight: '700', color: colors.finance, marginBottom: spacing.sm },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  splitName: { fontWeight: '600', color: colors.ink },
  splitValue: { color: colors.inkSoft, fontSize: 13 },
});
