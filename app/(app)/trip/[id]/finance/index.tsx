import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Badge, Card, EmptyState, Label, Screen } from '@/src/components/ui';
import { PaymentTimeline } from '@/src/components/finance/PaymentTimeline';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { exportCsvFile } from '@/src/lib/exportCsv';
import { buildFinanceCsv, financeCsvFilename } from '@/src/lib/financeCsv';
import { CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

export default function FinanceHome() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { trip, expenses, payments, members, canMutate, isAdmin, isFinanceLead } = useTrip();
  const [exporting, setExporting] = useState(false);

  const totals = useMemo(() => {
    const relevant = expenses.filter((e) => e.kind !== 'income');
    const total = relevant.reduce((s, e) => s + e.amount, 0);
    const paid = relevant.reduce(
      (s, e) => s + e.splits.reduce((ss, sp) => ss + sp.paidAmount, 0),
      0
    );
    return { total, paid };
  }, [expenses]);

  async function onExportCsv() {
    if (!trip || exporting) return;
    try {
      setExporting(true);
      const csv = buildFinanceCsv({ trip, expenses, payments, members });
      await exportCsvFile(financeCsvFilename(trip), csv);
      showSuccess('CSV exportado', 'Lançamentos, pagamentos e totais inclusos.');
    } catch (e) {
      if (e instanceof Error && e.message === 'EXPORT_CANCELLED') return;
      showError(e, 'Não foi possível exportar o CSV');
    } finally {
      setExporting(false);
    }
  }

  if (!trip) return null;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Finanças',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={onExportCsv}
                disabled={exporting}
                hitSlop={10}
                accessibilityLabel="Exportar CSV"
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && { opacity: 0.7 },
                  exporting && { opacity: 0.55 },
                ]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.finance} />
                ) : (
                  <Ionicons name="download-outline" size={18} color={colors.finance} />
                )}
                <Text style={styles.headerActionText}>CSV</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/(app)/trip/${trip.id}/finance/report`)}
                hitSlop={10}
                style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.finance} />
                <Text style={styles.headerActionText}>Relatório</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <FlatList
        style={styles.listFlex}
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
            <Card>
              <PaymentTimeline
                total={totals.total}
                paid={totals.paid}
                payments={payments}
                members={members}
              />
            </Card>
            <View style={styles.sectionHeader}>
              <Label>Lançamentos</Label>
              {canMutate ? (
                <Pressable
                  onPress={() => router.push(`/(app)/trip/${trip.id}/finance/new`)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.newAction,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={styles.newActionText}>Novo</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Sem lançamentos"
            subtitle={
              canMutate
                ? 'Toque em Novo para registrar uma despesa prevista ou real.'
                : 'Ainda não há despesas nesta viagem.'
            }
          />
        }
        renderItem={({ item }) => {
          const paid = item.splits.reduce((s, sp) => s + sp.paidAmount, 0);
          return (
            <Pressable
              onPress={() =>
                router.push(`/(app)/trip/${trip.id}/finance/expense/${item.id}`)
              }
            >
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
  listFlex: { flex: 1 },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: 4,
  },
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
  newAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.finance,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newActionText: {
    color: colors.white,
    fontFamily: fonts.uiBold,
    fontSize: 13,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontFamily: fonts.uiBold, color: colors.ink, fontSize: 15 },
  meta: { color: colors.inkSoft, fontSize: 12, fontFamily: fonts.ui },
  amount: { fontFamily: fonts.uiBold, color: colors.finance },
});
