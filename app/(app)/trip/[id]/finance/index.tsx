import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateValue } from '@/src/lib/dates';
import { expenseDay, fundSummary, openSplitsFor } from '@/src/lib/finance';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  Screen,
  SectionHeader,
  Segmented,
} from '@/src/components/ui';
import { FinanceFab } from '@/src/components/finance/FinanceFab';
import { PaymentTimeline } from '@/src/components/finance/PaymentTimeline';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { exportCsvFile } from '@/src/lib/exportCsv';
import { buildFinanceCsv, financeCsvFilename } from '@/src/lib/financeCsv';
import {
  buildTripExpensesWhatsAppSummary,
  FinanceShareCancelledError,
  shareFinanceSummary,
} from '@/src/lib/financeShare';
import { memberLabel } from '@/src/lib/members';
import { CATEGORY_LABELS, type Expense, type ExpenseCategory, type ExpenseKind } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

type KindFilter = 'all' | ExpenseKind;

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'actual', label: 'Realizado' },
  { id: 'planned', label: 'Previsto' },
  { id: 'income', label: 'Receitas' },
];

const CATEGORY_ICON: Record<
  ExpenseCategory,
  { name: React.ComponentProps<typeof IconTile>['name']; tone: React.ComponentProps<typeof IconTile>['tone'] }
> = {
  lodging: { name: 'bed-outline', tone: 'info' },
  transport: { name: 'car-outline', tone: 'neutral' },
  food: { name: 'restaurant-outline', tone: 'warn' },
  activities: { name: 'trail-sign-outline', tone: 'success' },
  other: { name: 'ellipsis-horizontal', tone: 'neutral' },
};

/** Settlement caption + tone shown under a row's amount. */
function expenseStatus(expense: Expense) {
  if (expense.fundId) {
    return expense.kind === 'income'
      ? { text: 'Entrou no caixa', tone: 'success' as const }
      : { text: 'Pago pelo caixa', tone: 'accent' as const };
  }
  if (expense.kind === 'income') return { text: 'Receita', tone: 'success' as const };
  const paid = expense.splits.reduce((s, sp) => s + sp.paidAmount, 0);
  if (paid >= expense.amount - 0.01) return { text: 'Quitado', tone: 'success' as const };
  if (paid <= 0 && expense.kind === 'planned') return { text: 'Não iniciado', tone: 'neutral' as const };
  const settled = expense.splits.filter((sp) => sp.paidAmount >= sp.amount - 0.01).length;
  return { text: `${settled} de ${expense.splits.length} pagos`, tone: 'warn' as const };
}

export default function FinanceHome() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const {
    trip,
    expenses,
    payments,
    members,
    funds,
    fundMovements,
    settlements,
    canMutate,
    isAdmin,
    isFinanceLead,
  } = useTrip();
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [filter, setFilter] = useState<KindFilter>('all');

  const totals = useMemo(() => {
    const relevant = expenses.filter((e) => e.kind !== 'income');
    const total = relevant.reduce((s, e) => s + e.amount, 0);
    const paid = relevant.reduce(
      (s, e) => s + e.splits.reduce((ss, sp) => ss + sp.paidAmount, 0),
      0
    );
    return { total, paid };
  }, [expenses]);

  const isManager = isFinanceLead || isAdmin;
  /** Payments the current user should confirm (everything for managers). */
  const pendingPayments = useMemo(
    () =>
      payments.filter(
        (p) => p.status === 'pending' && (isManager || (!!user && p.toUid === user.uid))
      ),
    [payments, isManager, user]
  );

  const fundRows = useMemo(
    () => funds.map((fund) => fundSummary(fund, fundMovements, expenses)),
    [funds, fundMovements, expenses]
  );
  const pendingFundMovements = useMemo(
    () =>
      fundMovements.filter((m) => {
        if (m.status !== 'pending') return false;
        return isManager || (!!user && m.holderUid === user.uid);
      }),
    [fundMovements, isManager, user]
  );

  const myOpen = useMemo(
    () => (user ? openSplitsFor(user.uid, expenses) : []),
    [user, expenses]
  );
  const myOpenTotal = myOpen.reduce((sum, item) => sum + item.remaining, 0);

  /** Expenses grouped by the day they happened, newest first. */
  const sections = useMemo(() => {
    const visible = expenses
      .filter((e) => filter === 'all' || e.kind === filter)
      .map((e) => ({ expense: e, day: expenseDay(e) }))
      .sort((a, b) => b.day.localeCompare(a.day) || b.expense.createdAt - a.expense.createdAt);
    const groups: { key: string; title: string; total: number; items: Expense[] }[] = [];
    for (const { expense, day } of visible) {
      let group = groups.find((g) => g.key === day);
      if (!group) {
        const date = parseDateValue(day);
        group = {
          key: day,
          title: date ? format(date, 'EEE, d MMM', { locale: ptBR }) : day,
          total: 0,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(expense);
      group.total += expense.kind === 'income' ? -expense.amount : expense.amount;
    }
    return groups;
  }, [expenses, filter]);

  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  async function onExportCsv() {
    if (!trip || exporting) return;
    try {
      setExporting(true);
      const csv = buildFinanceCsv({
        trip,
        expenses,
        payments,
        members,
        settlements,
        funds,
        fundMovements,
      });
      await exportCsvFile(financeCsvFilename(trip), csv);
      showSuccess('CSV exportado', 'Lançamentos, pagamentos e totais inclusos.');
    } catch (e) {
      if (e instanceof Error && e.message === 'EXPORT_CANCELLED') return;
      showError(e, 'Não foi possível exportar o CSV');
    } finally {
      setExporting(false);
    }
  }

  async function onShareWhatsApp() {
    if (!trip || sharing) return;
    try {
      setSharing(true);
      const message = buildTripExpensesWhatsAppSummary({
        trip,
        expenses,
        members,
        funds,
        fundMovements,
      });
      const result = await shareFinanceSummary({
        title: `Despesas — ${trip.name}`,
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

  if (!trip) return null;

  const firstPending = pendingPayments[0];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Finanças' }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <PageHeader
          title="Finanças"
          actions={
            <>
              <IconButton
                icon="download-outline"
                label="Exportar CSV"
                onPress={onExportCsv}
                loading={exporting}
              />
              <IconButton
                icon="logo-whatsapp"
                label="Enviar resumo no WhatsApp"
                onPress={onShareWhatsApp}
                loading={sharing}
              />
              <Button
                title="Relatório"
                icon="document-text-outline"
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/(app)/trip/${trip.id}/finance/report`)}
              />
            </>
          }
        />

        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        <Card>
          <PaymentTimeline
            total={totals.total}
            paid={totals.paid}
            payments={payments}
            members={members}
          />
        </Card>

        {firstPending ? (
          <Notice
            tone="warn"
            icon="time-outline"
            title={`${pendingPayments.length} ${pendingPayments.length === 1 ? 'pagamento aguarda' : 'pagamentos aguardam'}`}
            message="sua confirmação."
            actionLabel="Revisar"
            onAction={() =>
              router.push(`/(app)/trip/${trip.id}/finance/expense/${firstPending.expenseId}`)
            }
          />
        ) : null}

        {pendingFundMovements[0] ? (
          <Notice
            tone="warn"
            icon="wallet-outline"
            title={`${pendingFundMovements.length} ${pendingFundMovements.length === 1 ? 'aporte aguarda' : 'aportes aguardam'}`}
            message="confirmação no caixa."
            actionLabel="Abrir caixa"
            onAction={() =>
              router.push(`/(app)/trip/${trip.id}/finance/fund/${pendingFundMovements[0]!.fundId}`)
            }
          />
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Caixa da viagem"
            trailing={canMutate && funds.length ? 'Novo caixa' : undefined}
            onTrailingPress={
              canMutate && funds.length
                ? () => router.push(`/(app)/trip/${trip.id}/finance/fund/new`)
                : undefined
            }
          />
          {fundRows.length === 0 ? (
            <Notice
              tone="neutral"
              icon="wallet-outline"
              message="Alguém juntou dinheiro do grupo para pagar as despesas? Crie um caixa e acompanhe aportes, gastos e o saldo de cada um."
              actionLabel={canMutate ? 'Criar caixa' : undefined}
              onAction={
                canMutate ? () => router.push(`/(app)/trip/${trip.id}/finance/fund/new`) : undefined
              }
            />
          ) : (
            <ListGroup>
              {fundRows.map((row) => (
                <ListRow
                  key={row.fund.id}
                  leading={<IconTile name="wallet-outline" tone="accent" />}
                  title={row.fund.name}
                  subtitle={`Com ${nameOf(row.fund.holderUid)} · aportes ${formatCurrency(row.contributed)} · gastos ${formatCurrency(row.spent)}`}
                  value={formatCurrency(row.balance)}
                  valueCaption={row.balance < -0.01 ? 'Negativo' : 'Saldo'}
                  valueTone={row.balance < -0.01 ? 'danger' : 'success'}
                  chevron
                  onPress={() => router.push(`/(app)/trip/${trip.id}/finance/fund/${row.fund.id}`)}
                />
              ))}
            </ListGroup>
          )}
        </View>

        {myOpen.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Você deve" trailing={formatCurrency(myOpenTotal)} />
            <ListGroup>
              {myOpen.slice(0, 5).map(({ expense, remaining }) => (
                <ListRow
                  key={expense.id}
                  title={expense.title}
                  subtitle={`Para ${nameOf(expense.paidByUid)}`}
                  value={formatCurrency(remaining)}
                  valueCaption="em aberto"
                  valueTone="danger"
                  chevron
                  onPress={() => router.push(`/(app)/trip/${trip.id}/finance/expense/${expense.id}`)}
                />
              ))}
            </ListGroup>
            {myOpen.length > 5 ? (
              <Text style={styles.more}>{`+ ${myOpen.length - 5} lançamentos em aberto`}</Text>
            ) : null}
          </View>
        ) : null}

        <Segmented options={KIND_FILTERS} value={filter} onChange={setFilter} />

        {sections.length === 0 ? (
          <EmptyState
            title={expenses.length === 0 ? 'Sem lançamentos' : 'Nada neste filtro'}
            subtitle={
              expenses.length > 0
                ? 'Escolha outro tipo de lançamento.'
                : canMutate
                  ? 'Toque em + para registrar uma despesa ou receita.'
                  : 'Ainda não há despesas nesta viagem.'
            }
          />
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <SectionHeader title={section.title} trailing={formatCurrency(section.total)} />
              <ListGroup>
                {section.items.map((item) => {
                  const status = expenseStatus(item);
                  const icon = CATEGORY_ICON[item.category];
                  const kindLabel =
                    item.kind === 'planned' ? ' · Previsto' : item.kind === 'income' ? ' · Receita' : '';
                  const fund = item.fundId ? funds.find((f) => f.id === item.fundId) : undefined;
                  const payer = fund ? fund.name : nameOf(item.paidByUid);
                  return (
                    <ListRow
                      key={item.id}
                      leading={<IconTile name={icon.name} tone={icon.tone} />}
                      title={item.title}
                      subtitle={`${CATEGORY_LABELS[item.category]} · ${payer}${kindLabel}`}
                      value={`${item.kind === 'income' ? '+ ' : ''}${formatCurrency(item.amount)}`}
                      valueCaption={status.text}
                      valueTone={status.tone}
                      onPress={() =>
                        router.push(`/(app)/trip/${trip.id}/finance/expense/${item.id}`)
                      }
                    />
                  );
                })}
              </ListGroup>
            </View>
          ))
        )}
      </ScrollView>
      {canMutate ? <FinanceFab tripId={trip.id} funds={funds} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 120,
  },
  section: { gap: spacing.sm },
  more: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkSoft, paddingHorizontal: spacing.xs },
});
