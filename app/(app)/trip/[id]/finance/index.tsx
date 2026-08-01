import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Label, Screen } from '@/src/components/ui';
import { PaymentTimeline } from '@/src/components/finance/PaymentTimeline';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

export default function FinanceHome() {
  const router = useRouter();
  const { trip, expenses, payments, members } = useTrip();

  const totals = useMemo(() => {
    const relevant = expenses.filter((e) => e.kind !== 'income');
    const total = relevant.reduce((s, e) => s + e.amount, 0);
    const paid = relevant.reduce(
      (s, e) => s + e.splits.reduce((ss, sp) => ss + sp.paidAmount, 0),
      0
    );
    return { total, paid };
  }, [expenses]);

  if (!trip) return null;

  return (
    <Screen>
      <View style={styles.actions}>
        <Button title="Novo lançamento" variant="finance" onPress={() => router.push(`/(app)/trip/${trip.id}/finance/new`)} />
        <Button
          title="Relatório / acerto"
          variant="secondary"
          onPress={() => router.push(`/(app)/trip/${trip.id}/finance/report`)}
        />
      </View>

      <Card style={{ marginBottom: spacing.md }}>
        <PaymentTimeline
          total={totals.total}
          paid={totals.paid}
          payments={payments}
          members={members}
        />
      </Card>

      <Label>Lançamentos</Label>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm, paddingBottom: 80 }}
        ListEmptyComponent={
          <EmptyState title="Sem lançamentos" subtitle="Adicione despesas previstas ou reais." />
        }
        renderItem={({ item }) => {
          const paid = item.splits.reduce((s, sp) => s + sp.paidAmount, 0);
          return (
            <Pressable onPress={() => router.push(`/(app)/trip/${trip.id}/finance/expense/${item.id}`)}>
              <Card style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {CATEGORY_LABELS[item.category]} ·{' '}
                    {item.kind === 'income'
                      ? 'Receita'
                      : item.kind === 'planned'
                        ? 'Previsto'
                        : 'Execução'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                  <Badge
                    text={`${Math.round((paid / Math.max(item.amount, 1)) * 100)}%`}
                    tone={paid >= item.amount ? 'success' : 'warn'}
                  />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  meta: { color: colors.inkSoft, fontSize: 12 },
  amount: { fontWeight: '700', color: colors.finance },
});
