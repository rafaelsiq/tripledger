import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  Avatar,
  Badge,
  Body,
  Button,
  Card,
  Input,
  Label,
  ListGroup,
  Notice,
  Screen,
  SectionHeader,
} from '@/src/components/ui';
import { PaymentTimeline } from '@/src/components/finance/PaymentTimeline';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nextOpenInstallment, round2 } from '@/src/lib/finance';
import { formatDateLabel } from '@/src/lib/dates';
import {
  buildExpenseWhatsAppSummary,
  FinanceShareCancelledError,
  shareFinanceSummary,
} from '@/src/lib/financeShare';
import { memberLabel } from '@/src/lib/members';
import { confirmAction } from '@/src/lib/notify';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  cancelPayment,
  confirmPayment,
  canManageExpense,
  deleteExpense,
  registerPayment,
  rejectPayment,
  requestConsolidation,
  reversePayment,
  subscribeConsolidationRequests,
} from '@/src/services/expenses';
import type { ConsolidationRequest, ExpenseInstallment, Payment } from '@/src/types';
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
  const { trip, expenses, payments, members, funds, isFinanceLead, isAdmin, canMutate } =
    useTrip();
  const [amount, setAmount] = useState('');
  const [proxyUid, setProxyUid] = useState<string>('');
  const [myInstallmentId, setMyInstallmentId] = useState<string>('');
  const [proxyInstallmentId, setProxyInstallmentId] = useState<string>('');
  const [proofUri, setProofUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [reqs, setReqs] = useState<ConsolidationRequest[]>([]);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  const expense = expenses.find((e) => e.id === expenseId);
  const fund = expense?.fundId ? funds.find((f) => f.id === expense.fundId) : undefined;
  const coveredByFund = !!expense?.fundId;
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
    if (!expense || !canManageFinance || expense.fundId || expense.kind === 'income') return [];
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
    const value = round2(Number(String(amount).replace(',', '.')) || owedLeft);
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

  async function onShareWhatsApp() {
    if (sharing) return;
    try {
      setSharing(true);
      const message = buildExpenseWhatsAppSummary({
        trip: currentTrip,
        expense: currentExpense,
        members,
      });
      const result = await shareFinanceSummary({
        title: currentExpense.title,
        message,
      });
      if (result === 'copied') {
        showSuccess('Resumo copiado', 'Cole no WhatsApp do grupo');
      }
    } catch (e) {
      if (e instanceof FinanceShareCancelledError) return;
      showError(e, 'Não foi possível compartilhar o resumo');
    } finally {
      setSharing(false);
    }
  }

  const pendingForMe = expensePayments.filter(
    (p) =>
      p.status === 'pending' &&
      (p.toUid === currentUser.uid || isFinanceLead || isAdmin)
  );
  const myPendingSent = expensePayments.filter(
    (p) => p.status === 'pending' && p.fromUid === currentUser.uid
  );
  const history = expensePayments.slice().sort((a, b) => b.paidAt - a.paidAt);
  const openRequestFor = (paymentId: string) =>
    reqs.some((r) => r.paymentId === paymentId && r.status === 'pending');

  async function runPaymentAction(payment: Payment, action: () => Promise<void>, done: string) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    try {
      setBusyPaymentId(payment.id);
      await action();
      showSuccess(done);
    } catch (e) {
      showError(e, 'Não foi possível concluir');
    } finally {
      setBusyPaymentId(null);
    }
  }

  async function onCancelPayment(payment: Payment) {
    const ok = await confirmAction({
      title: 'Cancelar pagamento',
      message: `Remover o registro de ${formatCurrency(payment.amount)} que ainda aguarda confirmação?`,
      confirmText: 'Cancelar pagamento',
      cancelText: 'Voltar',
      destructive: true,
    });
    if (!ok) return;
    await runPaymentAction(
      payment,
      () => cancelPayment({ tripId: currentTrip.id, payment, actorUid: currentUser.uid }),
      'Pagamento cancelado'
    );
  }

  async function onReversePayment(payment: Payment) {
    const ok = await confirmAction({
      title: 'Estornar pagamento',
      message: `${formatCurrency(payment.amount)} de ${nameOf(payment.fromUid)} volta a ficar em aberto neste lançamento.`,
      confirmText: 'Estornar',
      destructive: true,
    });
    if (!ok) return;
    await runPaymentAction(
      payment,
      () =>
        reversePayment({
          tripId: currentTrip.id,
          paymentId: payment.id,
          actorUid: currentUser.uid,
        }),
      'Pagamento estornado'
    );
  }

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
          title: 'Lançamento',
          headerRight: canManageThisExpense
            ? () => (
                <Pressable
                  onPress={onEdit}
                  hitSlop={10}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.accent} />
                  <Text style={styles.headerActionText}>Editar</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <View style={{ gap: 6 }}>
          <View style={styles.badges}>
            <Badge text={CATEGORY_LABELS[expense.category]} tone="neutral" />
            <Badge
              text={
                expense.kind === 'income'
                  ? 'Receita'
                  : expense.kind === 'planned'
                    ? 'Previsto'
                    : 'Realizado'
              }
              tone={expense.kind === 'income' ? 'success' : expense.kind === 'planned' ? 'info' : 'neutral'}
            />
          </View>
          <Text style={styles.title}>{expense.title}</Text>
          <Text style={styles.meta}>
            {coveredByFund
              ? `${expense.kind === 'income' ? 'Entrou no caixa' : 'Pago pelo caixa'} ${fund?.name || ''} (com ${nameOf(expense.paidByUid)})`
              : `${expense.kind === 'income' ? 'Recebido por' : 'Pago por'} ${nameOf(expense.paidByUid)}`}{' '}
            · {expense.splits.length} {expense.splits.length === 1 ? 'pessoa' : 'pessoas'}
            {expense.date ? ` · ${formatDateLabel(expense.date)}` : ''}
          </Text>
          {expense.note ? <Body muted>{expense.note}</Body> : null}
        </View>

        {coveredByFund ? (
          <Notice
            tone="accent"
            icon="wallet-outline"
            message={
              expense.kind === 'income'
                ? 'Valor recebido no caixa: vira crédito no saldo de caixa de quem divide.'
                : 'Pago com o dinheiro do caixa: a parte de cada um é descontada do saldo no caixa, sem reembolso individual.'
            }
            actionLabel={fund ? 'Ver caixa' : undefined}
            onAction={
              fund
                ? () => router.push(`/(app)/trip/${currentTrip.id}/finance/fund/${fund.id}`)
                : undefined
            }
          />
        ) : expense.kind === 'income' ? (
          <Notice
            tone="success"
            icon="trending-up-outline"
            message={`${nameOf(expense.paidByUid)} recebeu este valor e fica devendo a parte de cada um — entra no acerto final.`}
          />
        ) : null}

        <Card>
          <PaymentTimeline
            title="Valor do lançamento"
            total={expense.amount}
            paid={paidTotal}
            payments={expensePayments}
            members={members}
          />
        </Card>

        <SectionHeader
          title={coveredByFund || expense.kind === 'income' ? 'Quem divide' : 'Quem deve'}
          trailing={
            coveredByFund || expense.kind === 'income'
              ? undefined
              : `${expense.splits.filter((s) => s.status === 'paid').length} de ${expense.splits.length} pagos`
          }
        />
        <ListGroup>
          {expense.splits.map((s) => {
            const userInstallments = installmentsByUser.get(s.uid) || [];
            const isMe = s.uid === currentUser.uid;
            const isPayer = s.uid === expense.paidByUid;
            return (
              <View key={s.uid} style={[styles.splitBlock, isMe && s.status !== 'paid' && styles.splitMine]}>
                <View style={styles.splitRow}>
                  <Avatar name={nameOf(s.uid)} size={32} />
                  <Text style={styles.splitName} numberOfLines={1}>
                    {isMe ? 'Você' : nameOf(s.uid)}
                  </Text>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={styles.splitValue}>{formatCurrency(s.amount)}</Text>
                    <Text
                      style={[
                        styles.splitStatus,
                        {
                          color:
                            s.status === 'paid'
                              ? colors.success
                              : s.status === 'partial'
                                ? colors.warn
                                : colors.danger,
                        },
                      ]}
                    >
                      {coveredByFund
                        ? 'Do caixa'
                        : expense.kind === 'income'
                          ? 'A receber'
                          : isPayer && s.status === 'paid'
                        ? 'Pagador'
                        : s.status === 'paid'
                          ? 'Pago'
                          : s.status === 'partial'
                            ? `Parcial · ${formatCurrency(s.paidAmount)}`
                            : 'Em aberto'}
                    </Text>
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
        </ListGroup>

        <Button
          title="Enviar resumo no WhatsApp"
          icon="logo-whatsapp"
          variant="secondary"
          size="sm"
          onPress={onShareWhatsApp}
          loading={sharing}
        />

        {canMutate &&
        !coveredByFund &&
        expense.kind !== 'income' &&
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
                  <View style={styles.pendingRow}>
                    <View style={styles.pendingIcon}>
                      <Ionicons
                        name={p.proofUrl ? 'document-attach-outline' : 'cash-outline'}
                        size={20}
                        color={colors.inkSoft}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.pendingTitle}>
                        {nameOf(p.fromUid)} enviou {formatCurrency(p.amount)}
                      </Text>
                      <Text style={styles.pendingMeta}>
                        {installment ? `${installment.index}ª parcela · ` : ''}
                        {p.proofUrl ? 'comprovante anexado' : 'sem comprovante'}
                      </Text>
                    </View>
                  </View>
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
                            await rejectPayment(trip.id, p.id, user.uid);
                            showSuccess('Pagamento rejeitado');
                          } catch (e) {
                            showError(e, 'Falha ao rejeitar');
                          }
                        }}
                      />
                    </View>
                  </View>
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
                if (!payment || payment.expenseId !== expense.id || payment.status !== 'pending') {
                  return null;
                }
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

        {canMutate && myPendingSent.length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Seus pagamentos aguardando</Label>
            <Body muted>
              {nameOf(expense.paidByUid)} ou o responsável financeiro precisam confirmar o recebimento.
            </Body>
            {myPendingSent.map((p) => (
              <View key={p.id} style={{ gap: spacing.sm }}>
                <Text style={styles.pendingTitle}>
                  {formatCurrency(p.amount)} · {format(p.paidAt, "d MMM 'às' HH:mm", { locale: ptBR })}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={openRequestFor(p.id) ? 'Cobrança enviada' : 'Pedir confirmação'}
                      variant="secondary"
                      size="sm"
                      disabled={openRequestFor(p.id) || busyPaymentId === p.id}
                      onPress={() => onRequestConsolidation(p.id)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cancelar"
                      variant="ghost"
                      size="sm"
                      loading={busyPaymentId === p.id}
                      onPress={() => onCancelPayment(p)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {history.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Histórico de pagamentos" trailing={String(history.length)} />
            <ListGroup>
              {history.map((p) => {
                const installment = installmentRef(p.installmentId);
                const statusText =
                  p.status === 'confirmed'
                    ? 'Confirmado'
                    : p.status === 'pending'
                      ? 'Aguardando'
                      : p.reversedAt
                        ? 'Estornado'
                        : 'Rejeitado';
                const statusColor =
                  p.status === 'confirmed'
                    ? colors.success
                    : p.status === 'pending'
                      ? colors.warn
                      : colors.inkSoft;
                return (
                  <View key={p.id} style={styles.historyRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.pendingTitle}>
                        {nameOf(p.fromUid)} → {nameOf(p.toUid)}
                      </Text>
                      <Text style={styles.pendingMeta}>
                        {format(p.paidAt, "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                        {installment ? ` · ${installment.index}ª parcela` : ''}
                        {p.proofUrl ? ' · com comprovante' : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text
                        style={[
                          styles.splitValue,
                          p.status === 'rejected' && { textDecorationLine: 'line-through', color: colors.inkSoft },
                        ]}
                      >
                        {formatCurrency(p.amount)}
                      </Text>
                      <Text style={[styles.splitStatus, { color: statusColor }]}>{statusText}</Text>
                      {canMutate && canManageFinance && p.status === 'confirmed' ? (
                        <Pressable
                          onPress={() => onReversePayment(p)}
                          disabled={busyPaymentId === p.id}
                          hitSlop={8}
                        >
                          <Text style={styles.linkDanger}>Estornar</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ListGroup>
          </View>
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
  title: { fontFamily: fonts.uiHeavy, fontSize: 22, letterSpacing: -0.3, color: colors.ink },
  meta: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkSoft },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  pendingMeta: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkSoft },
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
  splitBlock: {
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  splitMine: { backgroundColor: colors.warnSoft },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splitName: { flex: 1, fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  splitValue: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  splitStatus: { fontFamily: fonts.uiBold, fontSize: 12 },
  installmentList: { gap: 2, paddingLeft: 44 },
  installmentLine: { fontFamily: fonts.ui, color: colors.inkSoft, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  linkDanger: { color: colors.danger, fontFamily: fonts.uiBold, fontSize: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: { color: colors.inkLabel, fontFamily: fonts.uiSemi, fontSize: 13 },
  chipTextOn: { color: colors.accentDark, fontFamily: fonts.uiBold },
});
