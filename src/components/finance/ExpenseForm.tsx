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
import { createExpense, updateExpense, uploadTripFile } from '@/src/services/expenses';
import type { Expense, ExpenseCategory, ExpenseKind } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

const KINDS: { id: ExpenseKind; label: string }[] = [
  { id: 'planned', label: 'Previsto' },
  { id: 'actual', label: 'Durante a viagem' },
  { id: 'income', label: 'Receita' },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];
/** Quick shortcuts only — any count from 1 to MAX is allowed via the number field. */
const INSTALLMENT_PRESETS = [1, 2, 3, 6, 12];

type SplitDraft = {
  amount: string;
  installmentCount: number;
  /** Free-text while typing so the field can be cleared mid-edit. */
  installmentText?: string;
};

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

function buildEqualDrafts(
  memberIds: string[],
  total: number,
  defaultInstallments: number,
  paidByUid: string
): Record<string, SplitDraft> {
  const equal = equalSplits(memberIds, total);
  const next: Record<string, SplitDraft> = {};
  for (const split of equal) {
    next[split.uid] = {
      amount: String(split.amount),
      installmentCount: split.uid === paidByUid ? 1 : defaultInstallments,
    };
  }
  return next;
}

function draftsFromExpense(expense: Expense): {
  selected: string[];
  drafts: Record<string, SplitDraft>;
  defaultInstallments: number;
} {
  const selected = expense.splits.map((s) => s.uid);
  const drafts: Record<string, SplitDraft> = {};
  const debtorCounts: number[] = [];
  for (const split of expense.splits) {
    const count =
      split.uid === expense.paidByUid
        ? 1
        : split.installmentCount ||
          expense.installments?.filter((i) => i.uid === split.uid).length ||
          1;
    drafts[split.uid] = {
      amount: String(split.amount),
      installmentCount: count,
    };
    if (split.uid !== expense.paidByUid) debtorCounts.push(count);
  }
  const defaultInstallments = debtorCounts.sort((a, b) => a - b)[
    Math.floor(debtorCounts.length / 2)
  ] || 1;
  return { selected, drafts, defaultInstallments };
}

type Props = {
  mode: 'create' | 'edit';
  initialExpense?: Expense;
};

export function ExpenseForm({ mode, initialExpense }: Props) {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, members, canMutate, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();

  const seeded = draftsFromExpense(
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

  const [kind, setKind] = useState<ExpenseKind>(initialExpense?.kind || 'planned');
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
  const [splitDrafts, setSplitDrafts] = useState<Record<string, SplitDraft>>(
    mode === 'edit' ? seeded.drafts : {}
  );
  const [defaultInstallments, setDefaultInstallments] = useState(
    mode === 'edit' ? seeded.defaultInstallments : 1
  );
  const [defaultInstallmentsText, setDefaultInstallmentsText] = useState(
    String(mode === 'edit' ? seeded.defaultInstallments : 1)
  );
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | undefined>(
    initialExpense?.receiptUrl
  );
  const [clearReceipt, setClearReceipt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(mode === 'create' || !!initialExpense);

  useEffect(() => {
    if (mode !== 'edit' || !initialExpense || ready) return;
    const next = draftsFromExpense(initialExpense);
    setKind(initialExpense.kind);
    setCategory(initialExpense.category);
    setTitle(initialExpense.title);
    setAmount(String(initialExpense.amount));
    setNote(initialExpense.note || '');
    setDueDate(initialExpense.dueDate || '');
    setPaidByUid(initialExpense.paidByUid);
    setSelected(next.selected);
    setSplitDrafts(next.drafts);
    setDefaultInstallments(next.defaultInstallments);
    setDefaultInstallmentsText(String(next.defaultInstallments));
    setExistingReceiptUrl(initialExpense.receiptUrl);
    setReady(true);
  }, [mode, initialExpense, ready]);

  useEffect(() => {
    if (mode === 'edit') return;
    if (!members.length) return;
    setSelected((prev) => (prev.length ? prev : members.map((m) => m.uid)));
    setPaidByUid((prev) => prev || user?.uid || members[0]?.uid || '');
  }, [members, user?.uid, mode]);

  const totalValue = parseMoney(amount);

  useEffect(() => {
    if (!ready) return;
    if (!selected.length) {
      setSplitDrafts({});
      return;
    }
    setSplitDrafts((prev) => {
      const sameSet =
        selected.length === Object.keys(prev).length &&
        selected.every((uid) => !!prev[uid]);
      if (sameSet) {
        const kept: Record<string, SplitDraft> = {};
        for (const uid of selected) {
          kept[uid] = {
            amount: prev[uid]!.amount,
            installmentCount:
              uid === paidByUid ? 1 : prev[uid]!.installmentCount || defaultInstallments,
          };
        }
        return kept;
      }
      return buildEqualDrafts(selected, totalValue, defaultInstallments, paidByUid);
    });
  }, [selected, paidByUid, defaultInstallments, totalValue, ready]);

  const splitSum = useMemo(
    () => sumAmounts(selected.map((uid) => parseMoney(splitDrafts[uid]?.amount || '0'))),
    [selected, splitDrafts]
  );
  const splitsMatch = amountsMatchTotal(
    selected.map((uid) => parseMoney(splitDrafts[uid]?.amount || '0')),
    totalValue
  );

  function redistributeEqual() {
    setSplitDrafts(buildEqualDrafts(selected, totalValue, defaultInstallments, paidByUid));
  }

  function setMemberAmount(uid: string, value: string) {
    setSplitDrafts((prev) => ({
      ...prev,
      [uid]: {
        amount: value,
        installmentCount:
          prev[uid]?.installmentCount ??
          (uid === paidByUid ? 1 : defaultInstallments),
      },
    }));
  }

  function setMemberInstallments(uid: string, count: number, text?: string) {
    if (uid === paidByUid) return;
    const nextCount = clampInstallmentCount(count, defaultInstallments);
    setSplitDrafts((prev) => ({
      ...prev,
      [uid]: {
        amount: prev[uid]?.amount || '0',
        installmentCount: nextCount,
        installmentText: text ?? String(nextCount),
      },
    }));
  }

  function onMemberInstallmentText(uid: string, value: string) {
    const digits = digitsOnly(value);
    setSplitDrafts((prev) => {
      const current = prev[uid];
      if (!current) return prev;
      if (!digits) {
        return {
          ...prev,
          [uid]: { ...current, installmentText: '' },
        };
      }
      const nextCount = clampInstallmentCount(Number(digits), current.installmentCount);
      return {
        ...prev,
        [uid]: {
          ...current,
          installmentCount: nextCount,
          installmentText: digits,
        },
      };
    });
  }

  function applyDefaultInstallments(count: number, text?: string) {
    const nextCount = clampInstallmentCount(count, 1);
    setDefaultInstallments(nextCount);
    setDefaultInstallmentsText(text ?? String(nextCount));
    setSplitDrafts((prev) => {
      const next = { ...prev };
      for (const uid of selected) {
        if (uid === paidByUid) {
          next[uid] = {
            amount: next[uid]?.amount || '0',
            installmentCount: 1,
            installmentText: '1',
          };
        } else {
          next[uid] = {
            amount: next[uid]?.amount || '0',
            installmentCount: nextCount,
            installmentText: text ?? String(nextCount),
          };
        }
      }
      return next;
    });
  }

  function onDefaultInstallmentText(value: string) {
    const digits = digitsOnly(value);
    setDefaultInstallmentsText(digits);
    if (!digits) return;
    applyDefaultInstallments(Number(digits), digits);
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
        amount: parseMoney(splitDrafts[uid]?.amount || '0'),
        installmentCount:
          uid === paidByUid
            ? 1
            : splitDrafts[uid]?.installmentCount ?? defaultInstallments,
      }));

      if (mode === 'edit' && initialExpense) {
        await updateExpense({
          tripId: trip.id,
          expenseId: initialExpense.id,
          existing: initialExpense,
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
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  const debtors = selected.filter((uid) => uid !== paidByUid);
  const hasReceipt = !!receiptUri || (!!existingReceiptUrl && !clearReceipt);

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
          onChangeText={(value) => {
            setAmount(value);
            const nextTotal = parseMoney(value);
            setSplitDrafts(buildEqualDrafts(selected, nextTotal, defaultInstallments, paidByUid));
          }}
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
            <View style={styles.sectionHeader}>
              <Label>Valor por pessoa</Label>
              <Pressable onPress={redistributeEqual}>
                <Text style={styles.link}>Dividir igualmente</Text>
              </Pressable>
            </View>
            <Body muted>
              Ajuste quanto cada um deve. Soma atual: {formatCurrency(splitSum)}
              {!splitsMatch && totalValue > 0
                ? ` · falta ${formatCurrency(totalValue - splitSum)}`
                : ''}
            </Body>
            {selected.map((uid) => {
              const member = members.find((m) => m.uid === uid);
              return (
                <Input
                  key={uid}
                  label={
                    member
                      ? `${memberLabel(member)}${uid === paidByUid ? ' (pagador)' : ''}`
                      : uid
                  }
                  keyboardType="decimal-pad"
                  value={splitDrafts[uid]?.amount || ''}
                  onChangeText={(value) => setMemberAmount(uid, value)}
                  placeholder="0"
                />
              );
            })}
          </View>
        ) : null}

        {kind !== 'income' && debtors.length > 0 ? (
          <View style={styles.section}>
            <Label>Parcelas de quem te deve</Label>
            <Body muted>
              Defina quantas parcelas quiser (1 a {MAX_INSTALLMENT_COUNT}). A sugestão
              vale para todos; você pode ajustar por pessoa.
            </Body>
            <Input
              label="Parcelas (padrão do grupo)"
              keyboardType="number-pad"
              value={defaultInstallmentsText}
              onChangeText={onDefaultInstallmentText}
              placeholder={`1 a ${MAX_INSTALLMENT_COUNT}`}
            />
            <View style={styles.chips}>
              {INSTALLMENT_PRESETS.map((count) => (
                <Pressable
                  key={count}
                  onPress={() => applyDefaultInstallments(count)}
                  style={[styles.chip, defaultInstallments === count && styles.chipOn]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      defaultInstallments === count && styles.chipTextOn,
                    ]}
                  >
                    {count}x
                  </Text>
                </Pressable>
              ))}
            </View>

            {debtors.map((uid) => {
              const member = members.find((m) => m.uid === uid);
              const draft = splitDrafts[uid];
              const partAmount = parseMoney(draft?.amount || '0');
              const count = draft?.installmentCount || defaultInstallments;
              const countText = draft?.installmentText ?? String(count);
              return (
                <View key={uid} style={styles.debtorBlock}>
                  <Text style={styles.debtorName}>
                    {member ? memberLabel(member) : uid}
                  </Text>
                  <Input
                    label="Parcelas"
                    keyboardType="number-pad"
                    value={countText}
                    onChangeText={(value) => onMemberInstallmentText(uid, value)}
                    placeholder={`1 a ${MAX_INSTALLMENT_COUNT}`}
                  />
                  <View style={styles.chips}>
                    {INSTALLMENT_PRESETS.map((preset) => (
                      <Pressable
                        key={preset}
                        onPress={() => setMemberInstallments(uid, preset)}
                        style={[styles.chip, count === preset && styles.chipOn]}
                      >
                        <Text
                          style={[styles.chipText, count === preset && styles.chipTextOn]}
                        >
                          {preset}x
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Body muted>{installmentPreview(partAmount, count)}</Body>
                </View>
              );
            })}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  debtorBlock: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  debtorName: { fontWeight: '700', color: colors.ink },
});
