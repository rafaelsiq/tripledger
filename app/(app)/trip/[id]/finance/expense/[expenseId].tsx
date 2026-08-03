import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { nextOpenInstallment } from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import { confirmAction } from '@/src/lib/notify';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  confirmPayment,
  canManageExpense,
  deleteExpense,
  registerPayment,
  rejectPayment,
  requestConsolidation,
  subscribeConsolidationRequests,
} from '@/src/services/expenses';
import type { ConsolidationRequest, ExpenseInstallment } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

function installmentLabel(item: ExpenseInstallment) {
  const remaining = Math.max(0, Math.round((item.amount - item.paidAmount) * 100) / 100);
  return `${item.index}ª · ${formatCurrency(remaining)} restante`;
}

function remainingOf(item?: ExpenseInstallment | null) {
  if (!item) return 0;
  return Math.max(0, Math.round((item.amount - item.paidAmount) * 100) / 100);
}

export default function ExpenseDetailScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, expenses, payments, members, isFinanceLead, isAdmin, canMutate } = useTrip();
  const [amount, setAmount] = useState('');
  const [proxyUid, setProxyUid] = useState<string>('');
  const [myInstallmentId, setMyInstallmentId] = useState<string>('');
  const [proxyInstallmentId, setProxyInstallmentId] = useState<string>('');
  const [proofUri, setProofUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reqs, setReqs] = useState<ConsolidationRequest[]>([]);

  const expense = expenses.find((e) => e.id === expenseId);
  const expensePayments = payments.filter((p) => p.expenseId === expenseId);
  const canManageFinance = isAdmin || isFinanceLead;
  const canManageThisExpense =
    !!user &&
    !!expense &&
    canMutate &&
    canManageExpense(expense, {
      uid: user.uid,
      isAdmin,
      isFinanceLead,
    });

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

  const effectiveProxyUid = proxyUid || unpaidManagedSplits[0]?.uid || '';

  const myOpenInstallments = useMemo(() => {
    if (!expense?.installments?.length || !user?.uid) return [];
    return expense.installments
      .filter((i) => i.uid === user.uid && i.status !== 'paid')
      .sort((a, b) => a.index - b.index);
  }, [expense?.installments, user?.uid]);

  const proxyOpenInstallments = useMemo(() => {
    if (!expense?.installments?.length || !effectiveProxyUid) return [];
    return expense.installments
      .filter((i) => i.uid === effectiveProxyUid && i.status !== 'paid')
      .sort((a, b) => a.index - b.index);
  }, [expense?.installments, effectiveProxyUid]);

  const installmentsByUser = useMemo(() => {
    const map = new Map<string, ExpenseInstallment[]>();
    for (const item of expense?.installments || []) {
      const list = map.get(item.uid) || [];
      list.push(item);
      map.set(item.uid, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.index - b.index);
    }
    return map;
  }, [expense?.installments]);

  useEffect(() => {
    if (!myOpenInstallments.length) {
      setMyInstallmentId('');
      return;
    }
    setMyInstallmentId((prev) =>
      myOpenInstallments.some((i) => i.id === prev) ? prev : myOpenInstallments[0]!.id
    );
  }, [myOpenInstallments]);

  useEffect(() => {
    if (!proxyOpenInstallments.length) {
      setProxyInstallmentId('');
      return;
    }
    setProxyInstallmentId((prev) =>
      proxyOpenInstallments.some((i) => i.id === prev)
        ? prev
        : proxyOpenInstallments[0]!.id
    );
  }, [proxyOpenInstallments]);

  useEffect(() => {
    if (!expense?.installments?.length) return;
    const selected =
      expense.installments.find((i) => i.id === myInstallmentId) ||
      expense.installments.find((i) => i.id === proxyInstallmentId);
    if (!selected) return;
    const remaining = remainingOf(selected);
    setAmount(remaining ? String(remaining) : '');
    // Only autofill when the chosen installment changes — not on every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myInstallmentId, proxyInstallmentId]);

  if (!trip || !expense || !user) return null;

  const currentTrip = trip;
  const currentExpense = expense;
  const currentUser = user;

  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  const paidTotal = currentExpense.splits.reduce((s, sp) => s + sp.paidAmount, 0);
  const mySelectedInstallment =
    currentExpense.installments?.find((i) => i.id === myInstallmentId) ||
    nextOpenInstallment(currentExpense.installments, currentUser.uid);
  const proxySelectedInstallment =
    currentExpense.installments?.find((i) => i.id === proxyInstallmentId) ||
    nextOpenInstallment(currentExpense.installments, effectiveProxyUid);

  async function pickProof() {
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!pick.canceled) {
      setProofUri(pick.assets[0]?.uri);
    }
  }

  async function registerFor(
    fromUid: string,
    owedLeft: number,
    chosenInstallmentId?: string
  ) {
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
      const targetInstallment =
        currentExpense.installments?.find(
          (i) => i.id === chosenInstallmentId && i.uid === fromUid
        ) || nextOpenInstallment(currentExpense.installments, fromUid);
      await registerPayment({
        tripId: currentTrip.id,
        expenseId: currentExpense.id,
        fromUid,
        toUid: currentExpense.paidByUid,
        amount: value,
        installmentId: targetInstallment?.id,
        proofUri,
        expense: currentExpense,
      });
      setAmount('');
      setProofUri(undefined);
      showSuccess('Pagamento registrado', 'Aguardando consolidação.');
    } catch (e) {
      showError(e, 'Falha ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  }

  async function onPay() {
    if (!mySplit) return;
    await registerFor(
      currentUser.uid,
      mySplit.amount - mySplit.paidAmount,
      myInstallmentId
    );
  }

  async function onProxyPay() {
    const targetUid = effectiveProxyUid;
    const split = unpaidManagedSplits.find((s) => s.uid === targetUid);
    if (!split) {
      showError('Selecione quem está pagando.', 'Pagamento');
      return;
    }
    await registerFor(split.uid, split.amount - split.paidAmount, proxyInstallmentId);
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

  function onEdit() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (!canManageThisExpense) {
      showError(
        'Apenas quem lançou, o admin ou o responsável financeiro podem editar.',
        'Sem permissão'
      );
      return;
    }
    router.push(`/(app)/trip/${currentTrip.id}/finance/edit/${currentExpense.id}`);
  }

  async function onDelete() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (!canManageThisExpense) {
      showError(
        'Apenas quem lançou, o admin ou o responsável financeiro podem excluir.',
        'Sem permissão'
      );
      return;
    }
    const confirmed = await confirmAction({
      title: 'Excluir lançamento',
      message:
        'Isso remove o lançamento e os pagamentos ligados a ele. Essa ação não pode ser desfeita.',
      confirmText: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      setDeleting(true);
      await deleteExpense(currentTrip.id, currentExpense.id, currentUser.uid);
      showSuccess('Lançamento excluído');
      router.back();
    } catch (e) {
      showError(e, 'Falha ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  const pendingForMe = expensePayments.filter(
    (p) => p.status === 'pending' && (p.toUid === currentUser.uid || isFinanceLead)
  );

  function installmentRef(paymentInstallmentId?: string) {
    if (!paymentInstallmentId || !currentExpense.installments) return null;
    return currentExpense.installments.find((i) => i.id === paymentInstallmentId) || null;
  }

  function renderInstallmentPicker(
    openItems: ExpenseInstallment[],
    selectedId: string,
    onSelect: (id: string) => void
  ) {
    if (!openItems.length) return null;
    return (
      <View style={{ gap: spacing.sm }}>
        <Label>Parcela</Label>
        <Body muted>Escolha qual parcela este pagamento cobre.</Body>
        <View style={styles.chips}>
          {openItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={[styles.chip, selectedId === item.id && styles.chipOn]}
            >
              <Text
                style={[styles.chipText, selectedId === item.id && styles.chipTextOn]}
              >
                {installmentLabel(item)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  function renderProofControls() {
    return (
      <View style={{ gap: spacing.sm }}>
        <Button
          title={proofUri ? 'Comprovante anexado' : 'Anexar comprovante (opcional)'}
          variant="secondary"
          onPress={pickProof}
        />
        {proofUri ? (
          <Button
            title="Remover comprovante"
            variant="ghost"
            onPress={() => setProofUri(undefined)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Despesa',
          headerRight: canManageThisExpense
            ? () => (
                <Pressable
                  onPress={onEdit}
                  hitSlop={10}
                  style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.finance} />
                  <Text style={styles.headerActionText}>Editar</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

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
          {expense.splits.map((s) => {
            const userInstallments = installmentsByUser.get(s.uid) || [];
            return (
              <View key={s.uid} style={styles.splitBlock}>
                <View style={styles.splitRow}>
                  <Text style={styles.splitName}>{nameOf(s.uid)}</Text>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.splitValue}>
                      {formatCurrency(s.paidAmount)} / {formatCurrency(s.amount)}
                    </Text>
                    <Badge
                      text={
                        s.status === 'paid'
                          ? 'Pago'
                          : s.status === 'partial'
                            ? 'Parcial'
                            : 'Pendente'
                      }
                      tone={
                        s.status === 'paid'
                          ? 'success'
                          : s.status === 'partial'
                            ? 'warn'
                            : 'danger'
                      }
                    />
                  </View>
                </View>
                {userInstallments.length > 1 ||
                (userInstallments.length === 1 && s.uid !== expense.paidByUid) ? (
                  <View style={styles.installmentList}>
                    {userInstallments.map((item) => (
                      <Text key={item.id} style={styles.installmentLine}>
                        {item.index}ª parcela · {formatCurrency(item.paidAmount)} /{' '}
                        {formatCurrency(item.amount)}
                        {item.status === 'paid'
                          ? ' · paga'
                          : item.status === 'partial'
                            ? ' · parcial'
                            : ''}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        {canMutate &&
        mySplit &&
        mySplit.status !== 'paid' &&
        mySplit.uid !== expense.paidByUid ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Registrar meu pagamento</Label>
            {renderInstallmentPicker(
              myOpenInstallments,
              myInstallmentId,
              setMyInstallmentId
            )}
            <Input
              label="Valor"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder={String(
                remainingOf(mySelectedInstallment) || mySplit.amount - mySplit.paidAmount
              )}
            />
            {renderProofControls()}
            <Button
              title="Registrar pagamento"
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
                const selected = effectiveProxyUid === s.uid;
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
            {renderInstallmentPicker(
              proxyOpenInstallments,
              proxyInstallmentId,
              setProxyInstallmentId
            )}
            <Input
              label="Valor"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder={String(
                remainingOf(proxySelectedInstallment) ||
                  (() => {
                    const split = unpaidManagedSplits.find((s) => s.uid === effectiveProxyUid);
                    return split ? split.amount - split.paidAmount : 0;
                  })()
              )}
            />
            {renderProofControls()}
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
            {pendingForMe.map((p) => {
              const installment = installmentRef(p.installmentId);
              return (
                <View key={p.id} style={{ gap: spacing.sm }}>
                  <Text>
                    {nameOf(p.fromUid)} enviou {formatCurrency(p.amount)}
                    {installment ? ` · ${installment.index}ª parcela` : ''}
                    {p.proofUrl ? ' (com comprovante)' : ' (sem comprovante)'}
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
              );
            })}
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

        {canManageThisExpense ? (
          <View style={styles.deleteBlock}>
            <Body muted>Remove o lançamento e os pagamentos ligados a ele.</Body>
            <Button
              title="Excluir lançamento"
              variant="danger"
              onPress={onDelete}
              loading={deleting}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerActionText: {
    color: colors.finance,
    fontFamily: fonts.uiSemi,
    fontSize: 14,
  },
  deleteBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  amount: { fontSize: 28, fontWeight: '700', color: colors.finance, marginBottom: spacing.sm },
  splitBlock: {
    gap: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitName: { fontWeight: '600', color: colors.ink },
  splitValue: { color: colors.inkSoft, fontSize: 13 },
  installmentList: { gap: 2, paddingLeft: 2 },
  installmentLine: { color: colors.inkMuted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.finance,
    borderColor: colors.finance,
  },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.white },
});
