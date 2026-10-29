import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card } from '@/src/components/ui';
import { colors, fonts, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

type Props = {
  status: 'em_dia' | 'aguardando' | 'pendente';
  netOwed: number;
  pendingFromMe: number;
  /** Opens the finance tab; shown as the card's secondary action. */
  onOpenFinance?: () => void;
};

export function BalanceCard({ status, netOwed, pendingFromMe, onOpenFinance }: Props) {
  const tone =
    status === 'em_dia' ? 'success' : status === 'aguardando' ? 'warn' : 'danger';
  const label =
    status === 'em_dia' ? 'Em dia' : status === 'aguardando' ? 'Aguardando' : 'Pendente';
  const amountColor =
    status === 'em_dia' ? colors.success : status === 'aguardando' ? colors.warn : colors.danger;

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text style={styles.label}>Seu saldo</Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {status === 'em_dia' ? formatCurrency(0) : `− ${formatCurrency(netOwed)}`}
          </Text>
        </View>
        <Badge text={label} tone={tone} />
      </View>
      <Text style={styles.caption}>
        {status === 'em_dia'
          ? 'Nenhum valor em aberto nesta viagem.'
          : pendingFromMe > 0
            ? `${formatCurrency(pendingFromMe)} aguardando confirmação do responsável financeiro.`
            : 'Registre um pagamento para quitar (comprovante opcional).'}
      </Text>
      {onOpenFinance ? (
        <Button
          title={status === 'em_dia' ? 'Ver finanças' : 'Ver o que devo'}
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
