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
  distributeCents,
  equalSplits,
  sumAmounts,
} from '@/src/lib/finance';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import { createExpense, uploadTripFile } from '@/src/services/expenses';
import type { ExpenseCategory, ExpenseKind } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

const KINDS: { id: ExpenseKind; label: string }[] = [
  { id: 'planned', label: 'Previsto' },
  { id: 'actual', label: 'Durante a viagem' },
  { id: 'income', label: 'Receita' },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];
const INSTALLMENT_PRESETS = [1, 2, 3, 4, 6];

type SplitDraft = {
  amount: string;
  installmentCount: number;
};

function parseMoney(value: string) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
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

export default function NewExpenseScreen() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, members, canMutate, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();
  const [kind, setKind] = useState<ExpenseKind>('planned');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paidByUid, setPaidByUid] = useState(user?.uid || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [splitDrafts, setSplitDrafts] = useState<Record<string, SplitDraft>>({});
  const [defaultInstallments, setDefaultInstallments] = useState(1);
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!members.length) return;
    setSelected((prev) => (prev.length ? prev : members.map((m) => m.uid)));
    setPaidByUid((prev) => prev || user?.uid || members[0]?.uid || '');
  }, [members, user?.uid]);

  const totalValue = parseMoney(amount);

  useEffect(() => {
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
      // Redistribute when the set of people changes so totals stay coherent.
      return buildEqualDrafts(selected, totalValue, defaultInstallments, paidByUid);
    });
  }, [selected, paidByUid, defaultInstallments, totalValue]);

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

  function setMemberInstallments(uid: string, count: number) {
    if (uid === paidByUid) return;
    setSplitDrafts((prev) => ({
      ...prev,
      [uid]: {
        amount: prev[uid]?.amount || '0',
        installmentCount: count,
      },
    }));
  }

  function applyDefaultInstallments(count: number) {
    setDefaultInstallments(count);
    setSplitDrafts((prev) => {
      const next = { ...prev };
      for (const uid of selected) {
        if (uid === paidByUid) {
          next[uid] = { amount: next[uid]?.amount || '0', installmentCount: 1 };
        } else {
          next[uid] = {
            amount: next[uid]?.amount || '0',
            installmentCount: count,
          };
        }
      }
      return next;
    });
  }

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setReceiptUri(result.assets[0]?.uri);
    }
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
      router.back();
    } catch (e) {
      showError(e, 'Falha ao salvar');
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

  if (trip && !canMutate) {
    return (
      <Screen>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
        <Body muted>{closedTripMemberMessage()}</Body>
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
              Ajuste quanto cada um deve. Soma atual:{' '}
              {formatCurrency(splitSum)}
              {!splitsMatch && totalValue > 0 ? ` · falta ${formatCurrency(totalValue - splitSum)}` : ''}
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
              Sugestão inicial igual para todos; você pode mudar por pessoa.
            </Body>
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
              const parts = distributeCents(Math.round(partAmount * 100), count);
              return (
                <View key={uid} style={styles.debtorBlock}>
                  <Text style={styles.debtorName}>
                    {member ? memberLabel(member) : uid}
                  </Text>
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
                  <Body muted>
                    {count === 1
                      ? `1 parcela de ${formatCurrency(partAmount)}`
                      : parts
                          .map((cents, index) => `${index + 1}ª: ${formatCurrency(cents / 100)}`)
                          .join(' · ')}
                  </Body>
                </View>
              );
            })}
          </View>
        ) : null}

        <Button
          title={receiptUri ? 'Comprovante anexado (opcional)' : 'Anexar comprovante (opcional)'}
          variant="secondary"
          onPress={pickReceipt}
        />
        {receiptUri ? (
          <Button title="Remover comprovante" variant="ghost" onPress={() => setReceiptUri(undefined)} />
        ) : null}
        <Button title="Salvar" variant="finance" onPress={onSave} loading={loading} />
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
