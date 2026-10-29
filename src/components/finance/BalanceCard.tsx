import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card } from '@/src/components/ui';
import { colors, fonts, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

type Props = {
  /** Ledger position: positive = a receber, negative = a pagar. */
  net: number;
  /** Registered payments still waiting for confirmation. */
  pendingFromMe: number;
  /** Money the member still has inside trip funds (contributed − consumed). */
  fundBalance?: number;
  /** Opens the finance tab; shown as the card's secondary action. */
  onOpenFinance?: () => void;
};

export function BalanceCard({ net, pendingFromMe, fundBalance, onOpenFinance }: Props) {
  const settled = Math.abs(net) <= 0.01;
  const receiving = net > 0.01;
  const waiting = !settled && !receiving && pendingFromMe > 0.01;

  const tone = settled ? 'success' : receiving ? 'info' : waiting ? 'warn' : 'danger';
  const label = settled ? 'Em dia' : receiving ? 'A receber' : waiting ? 'Aguardando' : 'A pagar';
  const amountColor = settled
    ? colors.success
    : receiving
      ? colors.info
      : waiting
        ? colors.warn
        : colors.danger;

  const caption = settled
    ? 'Nada a pagar nem a receber nesta viagem.'
    : receiving
      ? 'O grupo te deve este valor (você adiantou mais do que consumiu).'
      : waiting
        ? `${formatCurrency(pendingFromMe)} aguardando confirmação do responsável financeiro.`
        : 'Registre um pagamento nos lançamentos em aberto ou aguarde o acerto final.';

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text style={styles.label}>Seu saldo</Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {settled
              ? formatCurrency(0)
              : `${receiving ? '+ ' : '− '}${formatCurrency(Math.abs(net))}`}
          </Text>
        </View>
        <Badge text={label} tone={tone} />
      </View>
      <Text style={styles.caption}>{caption}</Text>
      {fundBalance !== undefined && Math.abs(fundBalance) > 0.01 ? (
        <Text style={styles.caption}>
          {fundBalance > 0
            ? `Você ainda tem ${formatCurrency(fundBalance)} no caixa da viagem.`
            : `Seus gastos no caixa passaram ${formatCurrency(-fundBalance)} do que você aportou.`}
        </Text>
      ) : null}
      {onOpenFinance ? (
        <Button
          title={settled || receiving ? 'Ver finanças' : 'Ver o que devo'}
          variant="secondary"
          size="sm"
          onPress={onOpenFinance}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.inkSoft,
  },
  amount: {
    ...typography.number,
    fontSize: 32,
  },
  caption: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.ui,
  },
});
