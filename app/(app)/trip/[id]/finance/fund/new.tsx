import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Body, Button, Card, Input, Notice, Screen, SectionHeader } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { memberLabel } from '@/src/lib/members';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import { createFund } from '@/src/services/funds';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function NewFundScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, members, funds, canMutate, isAdmin, isFinanceLead } = useTrip();
  const [name, setName] = useState(funds.length ? '' : 'Caixa da viagem');
  const [holderUid, setHolderUid] = useState(user?.uid || '');
  const [saving, setSaving] = useState(false);

  if (!trip || !user) return null;
  const canPickHolder = isAdmin || isFinanceLead;
  const holderOptions = canPickHolder ? members : members.filter((m) => m.uid === user.uid);

  async function onSave() {
    if (!trip || !user) return;
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    try {
      setSaving(true);
      const fund = await createFund({
        tripId: trip.id,
        name,
        holderUid: holderUid || user.uid,
        actorUid: user.uid,
      });
      showSuccess('Caixa criado', 'Registre os aportes de cada pessoa.');
      router.replace(`/(app)/trip/${trip.id}/finance/fund/${fund.id}`);
    } catch (e) {
      showError(e, 'Não foi possível criar o caixa');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Novo caixa' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          tone="accent"
          icon="wallet-outline"
          title="Como funciona."
          message="O grupo junta dinheiro com uma pessoa, que paga as despesas comuns com ele. Cada gasto do caixa é descontado da parte de quem divide, e no fim o saldo é devolvido ou completado."
        />
        <Card style={styles.card}>
          <Input
            label="Nome do caixa"
            value={name}
            onChangeText={setName}
            placeholder="Caixa da viagem, Dinheiro em espécie…"
          />
        </Card>
        <View style={styles.section}>
          <SectionHeader title="Quem guarda o dinheiro" />
          <View style={styles.chips}>
            {holderOptions.map((m) => {
              const on = holderUid === m.uid;
              return (
                <Pressable
                  key={m.uid}
                  onPress={() => setHolderUid(m.uid)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {m.uid === user.uid ? 'Eu' : memberLabel(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!canPickHolder ? (
            <Body muted>Só o admin ou o responsável financeiro criam caixa para outra pessoa.</Body>
          ) : null}
        </View>
        <Button title="Criar caixa" variant="finance" onPress={onSave} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  section: { gap: spacing.sm },
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
});
