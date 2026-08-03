import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { DateField } from '@/src/components/DateField';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Input, Label, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import {
  amountsMatchTotal,
  clampInstallmentCount,
  distributeCents,
  equalSplits,
  MAX_INSTALLMENT_COUNT,
  sumAmounts,
} from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import { canManageExpense, createExpense, updateExpense, uploadTripFile } from '@/src/services/expenses';
import type { Expense, ExpenseCategory, ExpenseKind } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

const KINDS: { id: ExpenseKind; label: string }[] = [
  { id: 'planned', label: 'Previsto' },
  { id: 'actual', label: 'Durante a viagem' },
  { id: 'income', label: 'Receita' },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

function parseMoney(value: string) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function digitsOnly(value: string) {
  return String(value).replace(/[^\d]/g, '');
}

function installmentPreview(total: number, count: number) {
  const safeCount = clampInstallmentCount(count, 1);
  const parts = distributeCents(Math.round(total * 100), safeCount);
  if (safeCount === 1) return `1 parcela de ${formatCurrency(total)}`;
  const first = (parts[0] || 0) / 100;
  const last = (parts[parts.length - 1] || 0) / 100;
  if (Math.abs(first - last) < 0.001) {
    return `${safeCount} parcelas de ${formatCurrency(first)}`;
  }
  return `${safeCount} parcelas · ${formatCurrency(first)} cada (última ${formatCurrency(last)})`;
}

/** Equal split of remaining total after custom overrides. */
function resolveAmounts(
  selected: string[],
  total: number,
  customAmounts: Record<string, string>
): Record<string, number> {
  const customUids = selected.filter((uid) => customAmounts[uid] !== undefined);
  const customSum = sumAmounts(customUids.map((uid) => parseMoney(customAmounts[uid] || '0')));
  const freeUids = selected.filter((uid) => !customUids.includes(uid));
  const remaining = Math.max(0, Math.round((total - customSum) * 100) / 100);
  const equal = equalSplits(freeUids, remaining);
  const result: Record<string, number> = {};
  for (const uid of customUids) {
    result[uid] = parseMoney(customAmounts[uid] || '0');
  }
  for (const split of equal) {
    result[split.uid] = split.amount;
  }
  return result;
}

function seedFromExpense(expense: Expense): {
  selected: string[];
  customAmounts: Record<string, string>;
  defaultInstallments: number;
  customInstallments: Record<string, number>;
  equalMode: boolean;
} {
  const selected = expense.splits.map((s) => s.uid);
  const equal = equalSplits(selected, expense.amount);
  const equalByUid = Object.fromEntries(equal.map((s) => [s.uid, s.amount]));
  const customAmounts: Record<string, string> = {};
  let equalMode = true;
  for (const split of expense.splits) {
    const expected = equalByUid[split.uid] ?? 0;
    if (Math.abs(split.amount - expected) > 0.02) {
      equalMode = false;
      customAmounts[split.uid] = String(split.amount);
    }
  }

  const debtorCounts: number[] = [];
  const customInstallments: Record<string, number> = {};
  for (const split of expense.splits) {
    if (split.uid === expense.paidByUid) continue;
    const count =
      split.installmentCount ||
      expense.installments?.filter((i) => i.uid === split.uid).length ||
      1;
    debtorCounts.push(count);
  }
  const defaultInstallments =
    debtorCounts.sort((a, b) => a - b)[Math.floor(debtorCounts.length / 2)] || 1;
  for (const split of expense.splits) {
    if (split.uid === expense.paidByUid) continue;
    const count =
      split.installmentCount ||
      expense.installments?.filter((i) => i.uid === split.uid).length ||
      1;
    if (count !== defaultInstallments) {
      customInstallments[split.uid] = count;
    }
  }

  return {
    selected,
    customAmounts: equalMode ? {} : customAmounts,
    defaultInstallments,
    customInstallments,
    equalMode,
  };
}

type Props = {
  mode: 'create' | 'edit';
  initialExpense?: Expense;
  initialKind?: ExpenseKind;
};

export function ExpenseForm({ mode, initialExpense, initialKind }: Props) {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, members, canMutate, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();

  const seeded = seedFromExpense(
    initialExpense || {
      id: '',
      tripId: '',
      kind: 'planned',
      title: '',
      category: 'food',
      amount: 0,
      paidByUid: '',
      splits: [],
      createdByUid: '',
      createdAt: 0,
      updatedAt: 0,
    }
  );

  const [kind, setKind] = useState<ExpenseKind>(
    initialExpense?.kind || initialKind || 'planned'
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    initialExpense?.category || 'food'
  );
  const [title, setTitle] = useState(initialExpense?.title || '');
  const [amount, setAmount] = useState(
    initialExpense ? String(initialExpense.amount) : ''
  );
  const [note, setNote] = useState(initialExpense?.note || '');
  const [dueDate, setDueDate] = useState(initialExpense?.dueDate || '');
  const [paidByUid, setPaidByUid] = useState(
    initialExpense?.paidByUid || user?.uid || ''
  );
  const [selected, setSelected] = useState<string[]>(
    mode === 'edit' ? seeded.selected : []
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    mode === 'edit' ? seeded.customAmounts : {}
  );
  const [defaultInstallments, setDefaultInstallments] = useState(
    mode === 'edit' ? seeded.defaultInstallments : 1
  );
  const [defaultInstallmentsText, setDefaultInstallmentsText] = useState(
    String(mode === 'edit' ? seeded.defaultInstallments : 1)
  );
  const [customInstallments, setCustomInstallments] = useState<Record<string, number>>(
    mode === 'edit' ? seeded.customInstallments : {}
  );
  const [customInstallmentText, setCustomInstallmentText] = useState<Record<string, string>>(
    {}
  );
  const [showPersonAmountPicker, setShowPersonAmountPicker] = useState(false);
  const [showPersonInstallmentPicker, setShowPersonInstallmentPicker] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | undefined>(
    initialExpense?.receiptUrl
  );
  const [clearReceipt, setClearReceipt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(mode === 'create' || !!initialExpense);

  useEffect(() => {
    if (mode !== 'edit' || !initialExpense || ready) return;
    const next = seedFromExpense(initialExpense);
    setKind(initialExpense.kind);
    setCategory(initialExpense.category);
    setTitle(initialExpense.title);
    setAmount(String(initialExpense.amount));
    setNote(initialExpense.note || '');
    setDueDate(initialExpense.dueDate || '');
    setPaidByUid(initialExpense.paidByUid);
    setSelected(next.selected);
    setCustomAmounts(next.customAmounts);
    setDefaultInstallments(next.defaultInstallments);
    setDefaultInstallmentsText(String(next.defaultInstallments));
    setCustomInstallments(next.customInstallments);
    setExistingReceiptUrl(initialExpense.receiptUrl);
    setReady(true);
  }, [mode, initialExpense, ready]);

  useEffect(() => {
    if (mode === 'edit') return;
    if (!members.length) return;
    setSelected((prev) => (prev.length ? prev : members.map((m) => m.uid)));
    setPaidByUid((prev) => prev || user?.uid || members[0]?.uid || '');
  }, [members, user?.uid, mode]);

  useEffect(() => {
    if (mode === 'edit' || !initialKind) return;
    setKind(initialKind);
  }, [initialKind, mode]);

  const totalValue = parseMoney(amount);

  const resolvedAmounts = useMemo(
    () => resolveAmounts(selected, totalValue, customAmounts),
    [selected, totalValue, customAmounts]
  );

  const splitSum = useMemo(
    () => sumAmounts(selected.map((uid) => resolvedAmounts[uid] || 0)),
    [selected, resolvedAmounts]
  );
  const splitsMatch = amountsMatchTotal(
    selected.map((uid) => resolvedAmounts[uid] || 0),
    totalValue
  );

  const equalShare = useMemo(() => {
    if (!selected.length) return 0;
    const freeCount = selected.filter((uid) => customAmounts[uid] === undefined).length;
    if (!freeCount) return 0;
    const customSum = sumAmounts(
      Object.entries(customAmounts)
        .filter(([uid]) => selected.includes(uid))
        .map(([, value]) => parseMoney(value))
    );
    return Math.max(0, Math.round(((totalValue - customSum) / freeCount) * 100) / 100);
  }, [selected, customAmounts, totalValue]);

  const customizedAmountUids = selected.filter((uid) => customAmounts[uid] !== undefined);
  const customizedInstallmentUids = selected.filter(
    (uid) => uid !== paidByUid && customInstallments[uid] !== undefined
  );
  const debtors = selected.filter((uid) => uid !== paidByUid);

  function clearAmountOverride(uid: string) {
    setCustomAmounts((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  }

  function clearInstallmentOverride(uid: string) {
    setCustomInstallments((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
    setCustomInstallmentText((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  }

  function resetEqualAmounts() {
    setCustomAmounts({});
    setShowPersonAmountPicker(false);
  }

  function onDefaultInstallmentText(value: string) {
    const digits = digitsOnly(value);
    setDefaultInstallmentsText(digits);
    if (!digits) return;
    setDefaultInstallments(clampInstallmentCount(Number(digits), 1));
  }

  function onCustomInstallmentText(uid: string, value: string) {
    const digits = digitsOnly(value);
    setCustomInstallmentText((prev) => ({ ...prev, [uid]: digits }));
    if (!digits) return;
    setCustomInstallments((prev) => ({
      ...prev,
      [uid]: clampInstallmentCount(Number(digits), defaultInstallments),
    }));
  }

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setReceiptUri(result.assets[0]?.uri);
      setClearReceipt(false);
    }
  }

  function removeReceipt() {
    setReceiptUri(undefined);
    setExistingReceiptUrl(undefined);
    setClearReceipt(true);
  }

  async function onSave() {
    if (!user || !trip) {
      showError('Sessão ou viagem indisponível.', 'Não foi possível salvar');
      return;
    }
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (
      mode === 'edit' &&
      initialExpense &&
      !canManageExpense(initialExpense, {
        uid: user.uid,
        isAdmin,
        isFinanceLead,
      })
    ) {
      showError(
        'Apenas quem lançou, o admin ou o responsável financeiro podem editar.',
        'Sem permissão'
      );
      return;
    }
    if (!title.trim() || !totalValue) {
      showError('Preencha título e valor.', 'Campos obrigatórios');
      return;
    }
    if (selected.length === 0) {
      showError('Selecione quem divide a despesa.', 'Divisão incompleta');
      return;
    }
    if (kind !== 'income' && !splitsMatch) {
      showError(
        `A soma das partes (${formatCurrency(splitSum)}) deve ser ${formatCurrency(totalValue)}.`,
        'Divisão incorreta'
      );
      return;
    }
    try {
      setLoading(true);
      let receiptUrl: string | undefined;
      if (receiptUri) {
        receiptUrl = await uploadTripFile(trip.id, 'receipts', receiptUri);
      }
      const customSplits = selected.map((uid) => ({
        uid,
        amount: resolvedAmounts[uid] || 0,
        installmentCount:
          uid === paidByUid
            ? 1
            : customInstallments[uid] ?? defaultInstallments,
      }));

      if (mode === 'edit' && initialExpense) {
        await updateExpense({
          tripId: trip.id,
          expenseId: initialExpense.id,
          existing: initialExpense,
          actorUid: user.uid,
          kind,
          title,
          category,
          amount: totalValue,
          paidByUid: paidByUid || user.uid,
          memberIds: selected,
          customSplits,
          defaultInstallmentCount: defaultInstallments,
          note,
          dueDate: dueDate || undefined,
          receiptUrl,
          clearReceipt: clearReceipt && !receiptUri,
        });
        showSuccess('Lançamento atualizado', title);
      } else {
        await createExpense({
          tripId: trip.id,
          kind,
          title,
          category,
          amount: totalValue,
          paidByUid: paidByUid || user.uid,
          memberIds: selected,
          customSplits,
          defaultInstallmentCount: defaultInstallments,
          note,
          dueDate: dueDate || undefined,
          receiptUrl,
          createdByUid: user.uid,
        });
        showSuccess('Lançamento salvo', title);
      }
      router.back();
    } catch (e) {
      showError(e, mode === 'edit' ? 'Falha ao atualizar' : 'Falha ao salvar');
    } finally {
      setLoading(false);
    }
  }

  function toggleMember(uid: string) {
    setSelected((prev) => {
      const next = prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid];
      setCustomAmounts((amounts) => {
        const kept: Record<string, string> = {};
        for (const id of next) {
          if (amounts[id] !== undefined) kept[id] = amounts[id]!;
        }
        return kept;
      });
      setCustomInstallments((counts) => {
        const kept: Record<string, number> = {};
        for (const id of next) {
          if (counts[id] !== undefined) kept[id] = counts[id]!;
        }
        return kept;
      });
      return next;
    });
  }

  const hasReceipt = !!receiptUri || (!!existingReceiptUrl && !clearReceipt);
  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  if (trip && !canMutate) {
    return (
      <Screen>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <Body muted>{closedTripMemberMessage()}</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (mode === 'edit' && !initialExpense) {
    return (
      <Screen>
        <Body muted>Lançamento não encontrado.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.form}>
        {trip ? (
          <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        ) : null}
        {mode === 'edit' ? (
          <Body muted>
            Valores já pagos são preservados ao editar; parcelas são recalculadas.
          </Body>
        ) : null}

        <Label>Tipo</Label>
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Pressable
              key={k.id}
              onPress={() => setKind(k.id)}
              style={[styles.chip, kind === k.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, kind === k.id && styles.chipTextOn]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        <Label>Categoria</Label>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && styles.chipOn]}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
                {CATEGORY_LABELS[c]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input label="Título" value={title} onChangeText={setTitle} placeholder="Aluguel da casa" />
        <Input
          label="Valor (R$)"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="1200"
        />
        <DateField
          label="Vencimento"
          value={dueDate}
          onChange={setDueDate}
          placeholder="Opcional"
          optional
        />
        <Input label="Nota" value={note} onChangeText={setNote} placeholder="Observações" />

        <Label>Quem pagou / recebeu</Label>
        <View style={styles.chips}>
          {members.map((m) => (
            <Pressable
              key={m.uid}
              onPress={() => setPaidByUid(m.uid)}
              style={[styles.chip, paidByUid === m.uid && styles.chipOn]}
            >
              <Text style={[styles.chipText, paidByUid === m.uid && styles.chipTextOn]}>
                {memberLabel(m)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Label>Quem divide</Label>
        <View style={styles.chips}>
          {members.map((m) => (
            <Pressable
              key={m.uid}
              onPress={() => toggleMember(m.uid)}
              style={[styles.chip, selected.includes(m.uid) && styles.chipOn]}
            >
              <Text
                style={[styles.chipText, selected.includes(m.uid) && styles.chipTextOn]}
              >
                {memberLabel(m)}
              </Text>
            </Pressable>
          ))}
        </View>

        {kind !== 'income' && selected.length > 0 ? (
          <View style={styles.section}>
            <Label>Divisão por pessoa</Label>
            <View style={styles.equalCard}>
              <Text style={styles.equalTitle}>Divisão igualitária</Text>
              <Body muted>
                {selected.length === 1
                  ? `${formatCurrency(totalValue)} para ${nameOf(selected[0]!)}`
                  : customizedAmountUids.length
                    ? `Demais pessoas: cerca de ${formatCurrency(equalShare)} cada · soma ${formatCurrency(splitSum)}`
                    : `${formatCurrency(equalShare)} para cada um dos ${selected.length}`}
                {!splitsMatch && totalValue > 0
                  ? ` · ajuste necessário (${formatCurrency(totalValue - splitSum)})`
                  : ''}
              </Body>
            </View>

            {customizedAmountUids.map((uid) => (
              <View key={uid} style={styles.overrideRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.overrideName}>
                    {nameOf(uid)}
                    {uid === paidByUid ? ' (pagador)' : ''}
                  </Text>
                  <Input
                    keyboardType="decimal-pad"
                    value={customAmounts[uid] || ''}
                    onChangeText={(value) =>
                      setCustomAmounts((prev) => ({ ...prev, [uid]: value }))
                    }
                    placeholder="0"
                  />
                </View>
                <Pressable onPress={() => clearAmountOverride(uid)} hitSlop={8}>
                  <Text style={styles.link}>Igualar</Text>
                </Pressable>
              </View>
            ))}

            {showPersonAmountPicker ? (
              <View style={styles.pickerBlock}>
                <Body muted>Escolha quem terá um valor diferente:</Body>
                <View style={styles.chips}>
                  {selected
                    .filter((uid) => customAmounts[uid] === undefined)
                    .map((uid) => (
                      <Pressable
                        key={uid}
                        onPress={() => {
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [uid]: String(resolvedAmounts[uid] || equalShare || 0),
                          }));
                          setShowPersonAmountPicker(false);
                        }}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>{nameOf(uid)}</Text>
                      </Pressable>
                    ))}
                </View>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => setShowPersonAmountPicker(false)}
                />
              </View>
            ) : (
              <View style={styles.inlineActions}>
                {selected.some((uid) => customAmounts[uid] === undefined) ? (
                  <Pressable onPress={() => setShowPersonAmountPicker(true)}>
                    <Text style={styles.link}>Ajustar alguém</Text>
                  </Pressable>
                ) : null}
                {customizedAmountUids.length ? (
                  <Pressable onPress={resetEqualAmounts}>
                    <Text style={styles.link}>Voltar à divisão igual</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {kind !== 'income' && debtors.length > 0 ? (
          <View style={styles.section}>
            <Label>Parcelas</Label>
            <Body muted>
              Quantas vezes quem deve vai pagar (1 a {MAX_INSTALLMENT_COUNT}). Vale para
              todo o grupo; ajuste alguém só se for diferente.
            </Body>
            <Input
              label="Número de parcelas"
              keyboardType="number-pad"
              value={defaultInstallmentsText}
              onChangeText={onDefaultInstallmentText}
              placeholder={`Ex.: 1, 8, 24… (máx. ${MAX_INSTALLMENT_COUNT})`}
            />
            <Body muted>
              {installmentPreview(
                equalShare || (totalValue / Math.max(selected.length, 1)),
                defaultInstallments
              )}
            </Body>

            {customizedInstallmentUids.map((uid) => {
              const count = customInstallments[uid] || defaultInstallments;
              const countText = customInstallmentText[uid] ?? String(count);
              const partAmount = resolvedAmounts[uid] || 0;
              return (
                <View key={uid} style={styles.overrideRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.overrideName}>{nameOf(uid)}</Text>
                    <Input
                      label="Parcelas"
                      keyboardType="number-pad"
                      value={countText}
                      onChangeText={(value) => onCustomInstallmentText(uid, value)}
                      placeholder={`1 a ${MAX_INSTALLMENT_COUNT}`}
                    />
                    <Body muted>{installmentPreview(partAmount, count)}</Body>
                  </View>
                  <Pressable onPress={() => clearInstallmentOverride(uid)} hitSlop={8}>
                    <Text style={styles.link}>Padrão</Text>
                  </Pressable>
                </View>
              );
            })}

            {showPersonInstallmentPicker ? (
              <View style={styles.pickerBlock}>
                <Body muted>Escolha quem terá parcelas diferentes:</Body>
                <View style={styles.chips}>
                  {debtors
                    .filter((uid) => customInstallments[uid] === undefined)
                    .map((uid) => (
                      <Pressable
                        key={uid}
                        onPress={() => {
                          setCustomInstallments((prev) => ({
                            ...prev,
                            [uid]: defaultInstallments,
                          }));
                          setCustomInstallmentText((prev) => ({
                            ...prev,
                            [uid]: String(defaultInstallments),
                          }));
                          setShowPersonInstallmentPicker(false);
                        }}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>{nameOf(uid)}</Text>
                      </Pressable>
                    ))}
                </View>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => setShowPersonInstallmentPicker(false)}
                />
              </View>
            ) : debtors.some((uid) => customInstallments[uid] === undefined) ? (
              <Pressable onPress={() => setShowPersonInstallmentPicker(true)}>
                <Text style={styles.link}>Parcelas diferentes para alguém</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Button
          title={hasReceipt ? 'Comprovante anexado (opcional)' : 'Anexar comprovante (opcional)'}
          variant="secondary"
          onPress={pickReceipt}
        />
        {hasReceipt ? (
          <Button title="Remover comprovante" variant="ghost" onPress={removeReceipt} />
        ) : null}
        <Button
          title={mode === 'edit' ? 'Salvar alterações' : 'Salvar'}
          variant="finance"
          onPress={onSave}
          loading={loading}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
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
  section: { gap: spacing.sm },
  equalCard: {
    gap: 4,
    backgroundColor: colors.financeSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D0DAE4',
  },
  equalTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.finance,
  },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  overrideName: { fontFamily: fonts.uiBold, color: colors.ink, fontSize: 14 },
  pickerBlock: { gap: spacing.sm },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
