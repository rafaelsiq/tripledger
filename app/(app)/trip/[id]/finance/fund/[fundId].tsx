import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  Avatar,
  Body,
  Button,
  Card,
  EmptyState,
  IconTile,
  Input,
  Label,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  Screen,
  SectionHeader,
  Segmented,
} from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { formatDateLabel } from '@/src/lib/dates';
import { expenseDay, fundSummary, round2, type FundMemberSummary } from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import { confirmAction } from '@/src/lib/notify';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  addFundMovements,
  canManageFund,
  deleteFund,
  deleteFundMovement,
  renameFund,
  resolveFundMovement,
} from '@/src/services/funds';
import type { Expense, FundMovement } from '@/src/types';
import { colors, fonts, radii, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

type ContributionMode = 'one' | 'many';

const MODES: { id: ContributionMode; label: string }[] = [
  { id: 'one', label: 'Uma pessoa' },
  { id: 'many', label: 'Várias (mesmo valor)' },
];

/** Accepts "1.234,56", "1234,56" and "1234.56". */
function parseMoney(value: string) {
  let text = String(value).trim().replace(/[^\d.,-]/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

type HistoryItem =
  | { kind: 'movement'; at: number; movement: FundMovement }
  | { kind: 'expense'; at: number; expense: Expense };

export default function FundScreen() {
  const { fundId } = useLocalSearchParams<{ fundId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, funds, fundMovements, expenses, members, canMutate, isAdmin, isFinanceLead } =
    useTrip();

  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<ContributionMode>('one');
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const fund = funds.find((f) => f.id === fundId);
  const summary = useMemo(
    () => (fund ? fundSummary(fund, fundMovements, expenses) : null),
    [fund, fundMovements, expenses]
  );

  const memberRows = useMemo(() => {
    if (!summary) return [];
    const byUid = new Map(summary.members.map((m) => [m.uid, m]));
    const rows: FundMemberSummary[] = members.map(
      (m) => byUid.get(m.uid) || { uid: m.uid, contributed: 0, refunded: 0, consumed: 0, balance: 0 }
    );
    // Keep former members that still have money in the fund.
    for (const item of summary.members) {
      if (!rows.some((r) => r.uid === item.uid)) rows.push(item);
    }
    return rows;
  }, [summary, members]);

  const history = useMemo<HistoryItem[]>(() => {
    if (!summary) return [];
    const items: HistoryItem[] = [
      ...summary.movements.map((movement) => ({
        kind: 'movement' as const,
        at: movement.createdAt,
        movement,
      })),
      ...summary.expenses.map((expense) => ({
        kind: 'expense' as const,
        at: expense.createdAt,
        expense,
      })),
    ];
    return items.sort((a, b) => b.at - a.at);
  }, [summary]);

  if (!trip || !user) return null;
  if (!fund || !summary) {
    return (
      <Screen>
        <EmptyState title="Caixa não encontrado" subtitle="Ele pode ter sido excluído." />
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const currentTrip = trip;
  const currentFund = fund;
  const currentUser = user;
  const manager = canManageFund(fund, { uid: user.uid, isAdmin, isFinanceLead });
  const canAct = canMutate;

  const nameOf = (uid: string) => {
    if (uid === currentUser.uid) return 'Você';
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Ex-membro';
  };

  const pendingMovements = summary.movements.filter((m) => m.status === 'pending');
  const positiveBalances = memberRows.filter((r) => r.balance > 0.01);

  function openForm(preset?: { uid: string; amount?: number }) {
    if (!canAct) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    setMode('one');
    setSelected([preset?.uid || (manager ? '' : currentUser.uid)].filter(Boolean));
    setAmount(preset?.amount ? String(preset.amount).replace('.', ',') : '');
    setNote('');
    setFormOpen(true);
  }

  function toggle(uid: string) {
    if (!manager) return;
    setSelected((prev) => {
      if (mode === 'one') return [uid];
      return prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid];
    });
  }

  async function onSubmitContribution() {
    const value = round2(parseMoney(amount));
    const targets = manager ? selected : [currentUser.uid];
    if (!targets.length) {
      showError('Escolha quem fez o aporte.', 'Aporte');
      return;
    }
    if (value <= 0) {
      showError('Informe um valor maior que zero.', 'Aporte');
      return;
    }
    try {
      setSaving(true);
      await addFundMovements({
        tripId: currentTrip.id,
        fund: currentFund,
        type: 'contribution',
        entries: targets.map((uid) => ({ memberUid: uid, amount: value })),
        note,
        actorUid: currentUser.uid,
      });
      showSuccess(
        manager ? 'Aporte registrado' : 'Aporte enviado',
        manager
          ? `${formatCurrency(value * targets.length)} no caixa.`
          : `${nameOf(currentFund.holderUid)} precisa confirmar o recebimento.`
      );
      setFormOpen(false);
      setAmount('');
      setNote('');
    } catch (e) {
      showError(e, 'Não foi possível registrar o aporte');
    } finally {
      setSaving(false);
    }
  }

  async function onRefund(rows: FundMemberSummary[]) {
    if (!canAct) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const total = round2(rows.reduce((sum, r) => sum + r.balance, 0));
    const ok = await confirmAction({
      title: rows.length === 1 ? 'Devolver saldo' : 'Devolver todos os saldos',
      message:
        rows.length === 1
          ? `Registrar que ${nameOf(currentFund.holderUid)} devolveu ${formatCurrency(total)} para ${nameOf(rows[0]!.uid)}?`
          : `Registrar a devolução de ${formatCurrency(total)} para ${rows.length} pessoas e zerar os saldos?`,
      confirmText: 'Registrar devolução',
    });
    if (!ok) return;
    try {
      setBusyId(rows.length === 1 ? rows[0]!.uid : 'all');
      await addFundMovements({
        tripId: currentTrip.id,
        fund: currentFund,
        type: 'refund',
        entries: rows.map((r) => ({ memberUid: r.uid, amount: r.balance })),
        actorUid: currentUser.uid,
      });
      showSuccess('Devolução registrada');
    } catch (e) {
      showError(e, 'Não foi possível registrar a devolução');
    } finally {
      setBusyId(null);
    }
  }

  async function onResolve(movement: FundMovement, status: 'confirmed' | 'rejected') {
    try {
      setBusyId(movement.id);
      await resolveFundMovement({
        tripId: currentTrip.id,
        fund: currentFund,
        movement,
        status,
        actorUid: currentUser.uid,
      });
      showSuccess(status === 'confirmed' ? 'Aporte confirmado' : 'Aporte rejeitado');
    } catch (e) {
      showError(e, 'Não foi possível concluir');
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteMovement(movement: FundMovement) {
    const ok = await confirmAction({
      title: movement.type === 'contribution' ? 'Remover aporte' : 'Remover devolução',
      message: `${formatCurrency(movement.amount)} de ${nameOf(movement.memberUid)} sai do histórico e do saldo do caixa.`,
      confirmText: 'Remover',
      destructive: true,
    });
    if (!ok) return;
    try {
      setBusyId(movement.id);
      await deleteFundMovement({
        tripId: currentTrip.id,
        fund: currentFund,
        movement,
        actorUid: currentUser.uid,
      });
      showSuccess('Registro removido');
    } catch (e) {
      showError(e, 'Não foi possível remover');
    } finally {
      setBusyId(null);
    }
  }

  async function onRename() {
    try {
      await renameFund({
        tripId: currentTrip.id,
        fund: currentFund,
        name: nameDraft,
        actorUid: currentUser.uid,
      });
      setRenaming(false);
      showSuccess('Caixa renomeado');
    } catch (e) {
      showError(e, 'Não foi possível renomear');
    }
  }

  async function onDeleteFund() {
    const ok = await confirmAction({
      title: 'Excluir caixa',
      message: 'Só é possível excluir um caixa sem aportes nem gastos.',
      confirmText: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteFund({ tripId: currentTrip.id, fund: currentFund, actorUid: currentUser.uid });
      showSuccess('Caixa excluído');
      router.back();
    } catch (e) {
      showError(e, 'Não foi possível excluir');
    }
  }

  const negative = summary.balance < -0.01;
  const amountValue = parseMoney(amount);
  const targets = manager ? selected : [currentUser.uid];

  return (
    <Screen>
      <Stack.Screen options={{ title: fund.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          title={fund.name}
          subtitle={`Dinheiro com ${nameOf(fund.holderUid)}`}
          actions={
            manager && canAct ? (
              <Button
                title="Renomear"
                icon="create-outline"
                variant="secondary"
                size="sm"
                onPress={() => {
                  setNameDraft(fund.name);
                  setRenaming((v) => !v);
                }}
              />
            ) : undefined
          }
        />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        {renaming ? (
          <Card style={styles.card}>
            <Input label="Nome do caixa" value={nameDraft} onChangeText={setNameDraft} />
            <View style={styles.rowActions}>
              <View style={{ flex: 1 }}>
                <Button title="Salvar" variant="finance" size="sm" onPress={onRename} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Cancelar" variant="ghost" size="sm" onPress={() => setRenaming(false)} />
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.caption}>Saldo no caixa</Text>
          <Text style={[styles.number, negative && { color: colors.danger }]}>
            {formatCurrency(summary.balance)}
          </Text>
          <View style={styles.kpis}>
            <Kpi label="Aportes" value={formatCurrency(summary.contributed)} color={colors.success} />
            <Kpi label="Gastos" value={formatCurrency(summary.spent)} />
            <Kpi label="Devolvido" value={formatCurrency(summary.refunded)} />
          </View>
          {summary.received > 0 ? (
            <Body muted>{`Entradas no caixa (reembolsos, devoluções): ${formatCurrency(summary.received)}`}</Body>
          ) : null}
          {summary.pendingContributions > 0 ? (
            <Body muted>{`${formatCurrency(summary.pendingContributions)} em aportes aguardando confirmação.`}</Body>
          ) : null}
        </Card>

        {negative ? (
          <Notice
            tone="warn"
            icon="alert-circle-outline"
            title="Caixa no negativo."
            message={`${nameOf(fund.holderUid)} cobriu ${formatCurrency(-summary.balance)} do próprio bolso. Peça um novo aporte para quem está com saldo negativo.`}
          />
        ) : null}

        {canAct ? (
          <View style={styles.rowActions}>
            <View style={{ flex: 1 }}>
              <Button
                title={manager ? 'Registrar aporte' : 'Informar meu aporte'}
                icon="add-circle-outline"
                variant="finance"
                onPress={() => (formOpen ? setFormOpen(false) : openForm())}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Lançar gasto"
                icon="receipt-outline"
                variant="secondary"
                onPress={() =>
                  router.push(`/(app)/trip/${trip.id}/finance/new?kind=actual&fundId=${fund.id}`)
                }
              />
            </View>
          </View>
        ) : null}

        {formOpen ? (
          <Card style={styles.card}>
            <Label>{manager ? 'Novo aporte' : 'Informar aporte'}</Label>
            {manager ? (
              <>
                <Segmented
                  options={MODES}
                  value={mode}
                  onChange={(next) => {
                    setMode(next);
                    if (next === 'one') setSelected((prev) => prev.slice(0, 1));
                  }}
                />
                <View style={styles.chips}>
                  {members.map((m) => {
                    const on = selected.includes(m.uid);
                    return (
                      <Pressable
                        key={m.uid}
                        onPress={() => toggle(m.uid)}
                        accessibilityRole={mode === 'one' ? 'radio' : 'checkbox'}
                        accessibilityState={{ checked: on }}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {nameOf(m.uid)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {mode === 'many' ? (
                  <Pressable
                    onPress={() =>
                      setSelected(
                        selected.length === members.length ? [] : members.map((m) => m.uid)
                      )
                    }
                  >
                    <Text style={styles.link}>
                      {selected.length === members.length ? 'Limpar seleção' : 'Selecionar todos'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Body muted>
                {`Informe quanto você passou para ${nameOf(fund.holderUid)}. O valor entra no caixa depois da confirmação.`}
              </Body>
            )}
            <Input
              label={mode === 'many' && manager ? 'Valor por pessoa (R$)' : 'Valor (R$)'}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0,00"
            />
            <Input label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="Pix, dinheiro…" />
            {targets.length > 1 && amountValue > 0 ? (
              <Body muted>{`Total: ${formatCurrency(round2(amountValue * targets.length))} de ${targets.length} pessoas.`}</Body>
            ) : null}
            <Button title="Salvar aporte" variant="finance" onPress={onSubmitContribution} loading={saving} />
            <Button title="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} />
          </Card>
        ) : null}

        {pendingMovements.length > 0 ? (
          <Card style={styles.pendingCard}>
            <Label>Aportes aguardando confirmação</Label>
            {pendingMovements.map((m) => (
              <View key={m.id} style={styles.pendingItem}>
                <Text style={styles.itemTitle}>
                  {nameOf(m.memberUid)} informou {formatCurrency(m.amount)}
                </Text>
                {m.note ? <Body muted>{m.note}</Body> : null}
                {manager && canAct ? (
                  <View style={styles.rowActions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Confirmar"
                        variant="finance"
                        size="sm"
                        loading={busyId === m.id}
                        onPress={() => onResolve(m, 'confirmed')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Rejeitar"
                        variant="danger"
                        size="sm"
                        disabled={busyId === m.id}
                        onPress={() => onResolve(m, 'rejected')}
                      />
                    </View>
                  </View>
                ) : m.createdByUid === user.uid && canAct ? (
                  <Button
                    title="Cancelar"
                    variant="ghost"
                    size="sm"
                    loading={busyId === m.id}
                    onPress={() => onDeleteMovement(m)}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Saldo de cada pessoa"
            trailing={
              manager && canAct && positiveBalances.length > 1 ? 'Devolver todos' : undefined
            }
            onTrailingPress={
              manager && canAct && positiveBalances.length > 1
                ? () => onRefund(positiveBalances)
                : undefined
            }
          />
          <ListGroup>
            {memberRows.map((row) => {
              const positive = row.balance > 0.01;
              const owes = row.balance < -0.01;
              return (
                <View key={row.uid} style={styles.memberRow}>
                  <Avatar name={nameOf(row.uid)} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {nameOf(row.uid)}
                    </Text>
                    <Text style={styles.meta}>
                      {`Aportou ${formatCurrency(row.contributed)} · consumiu ${formatCurrency(row.consumed)}`}
                      {row.refunded > 0 ? ` · recebeu ${formatCurrency(row.refunded)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text
                      style={[
                        styles.value,
                        { color: positive ? colors.success : owes ? colors.danger : colors.inkSoft },
                      ]}
                    >
                      {formatCurrency(row.balance)}
                    </Text>
                    {positive && manager && canAct ? (
                      <Pressable
                        onPress={() => onRefund([row])}
                        disabled={busyId === row.uid}
                        hitSlop={8}
                      >
                        <Text style={styles.link}>Devolver</Text>
                      </Pressable>
                    ) : owes && canAct && (manager || row.uid === user.uid) ? (
                      <Pressable
                        onPress={() => openForm({ uid: row.uid, amount: -row.balance })}
                        hitSlop={8}
                      >
                        <Text style={styles.link}>Completar</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.meta}>{positive ? 'a devolver' : owes ? 'falta' : 'zerado'}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ListGroup>
          <Text style={styles.footnote}>
            Saldo = aportes − devoluções − sua parte nos gastos do caixa. Positivo: há dinheiro seu no
            caixa. Negativo: você consumiu mais do que aportou.
          </Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Movimentações" trailing={history.length ? String(history.length) : undefined} />
          {history.length === 0 ? (
            <EmptyState
              title="Nada por aqui ainda"
              subtitle="Registre os aportes e lance os gastos pagos com o dinheiro do caixa."
            />
          ) : (
            <ListGroup>
              {history.map((item) => {
                if (item.kind === 'expense') {
                  const e = item.expense;
                  const isIncome = e.kind === 'income';
                  return (
                    <ListRow
                      key={`e_${e.id}`}
                      leading={
                        <IconTile
                          name={isIncome ? 'arrow-down-outline' : 'receipt-outline'}
                          tone={isIncome ? 'success' : 'neutral'}
                        />
                      }
                      title={e.title}
                      subtitle={`${isIncome ? 'Entrada' : 'Gasto'} · ${formatDateLabel(expenseDay(e))}`}
                      value={`${isIncome ? '+' : '−'} ${formatCurrency(e.amount)}`}
                      valueTone={isIncome ? 'success' : 'neutral'}
                      chevron
                      onPress={() => router.push(`/(app)/trip/${trip.id}/finance/expense/${e.id}`)}
                    />
                  );
                }
                const m = item.movement;
                const isContribution = m.type === 'contribution';
                const statusText =
                  m.status === 'pending' ? 'Aguardando' : m.status === 'rejected' ? 'Rejeitado' : undefined;
                const canDelete =
                  canAct && (manager || (m.status === 'pending' && m.createdByUid === user.uid));
                return (
                  <ListRow
                    key={`m_${m.id}`}
                    leading={
                      <IconTile
                        name={isContribution ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                        tone={isContribution ? 'accent' : 'info'}
                      />
                    }
                    title={`${isContribution ? 'Aporte' : 'Devolução'} · ${nameOf(m.memberUid)}`}
                    subtitle={[format(m.createdAt, "d MMM 'às' HH:mm", { locale: ptBR }), m.note]
                      .filter(Boolean)
                      .join(' · ')}
                    value={`${isContribution ? '+' : '−'} ${formatCurrency(m.amount)}`}
                    valueCaption={statusText}
                    valueTone={m.status === 'pending' ? 'warn' : 'neutral'}
                    trailing={
                      canDelete ? (
                        <Pressable
                          onPress={() => onDeleteMovement(m)}
                          disabled={busyId === m.id}
                          accessibilityRole="button"
                          accessibilityLabel="Remover registro"
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.inkMuted} />
                        </Pressable>
                      ) : undefined
                    }
                  />
                );
              })}
            </ListGroup>
          )}
        </View>

        {manager && canAct && history.length === 0 ? (
          <Button title="Excluir caixa" variant="danger" onPress={onDeleteFund} />
        ) : null}
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
  pendingCard: { gap: 12, borderColor: colors.warn, backgroundColor: colors.warnSoft },
  pendingItem: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.warnBorder,
  },
  caption: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkSoft },
  number: { ...typography.number },
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
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.inkLabel, fontFamily: fonts.uiSemi, fontSize: 13 },
  chipTextOn: { color: colors.accentDark, fontFamily: fonts.uiBold },
  link: { color: colors.accent, fontFamily: fonts.uiBold, fontSize: 13 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  itemTitle: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkSoft },
  value: { fontFamily: fonts.uiBold, fontSize: 15, fontVariant: ['tabular-nums'] },
  footnote: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
});
