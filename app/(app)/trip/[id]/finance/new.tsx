import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { DateField } from '@/src/components/DateField';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Input, Label, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import { createExpense, uploadTripFile } from '@/src/services/expenses';
import type { ExpenseCategory, ExpenseKind } from '@/src/types';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, radii, spacing } from '@/src/theme';

const KINDS: { id: ExpenseKind; label: string }[] = [
  { id: 'planned', label: 'Previsto' },
  { id: 'actual', label: 'Durante a viagem' },
  { id: 'income', label: 'Receita' },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

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
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.uid));
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

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
    const value = Number(String(amount).replace(',', '.'));
    if (!title.trim() || !value) {
      showError('Preencha título e valor.', 'Campos obrigatórios');
      return;
    }
    if (selected.length === 0) {
      showError('Selecione quem divide a despesa.', 'Divisão incompleta');
      return;
    }
    try {
      setLoading(true);
      let receiptUrl: string | undefined;
      if (receiptUri) {
        receiptUrl = await uploadTripFile(trip.id, 'receipts', receiptUri);
      }
      await createExpense({
        tripId: trip.id,
        kind,
        title,
        category,
        amount: value,
        paidByUid: paidByUid || user.uid,
        memberIds: selected,
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

        <Button
          title={receiptUri ? 'Comprovante anexado' : 'Anexar print/comprovante'}
          variant="secondary"
          onPress={pickReceipt}
        />
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
});
