import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Badge, Card } from '@/src/components/ui';
import { colors, fonts, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';

type Props = {
  status: 'em_dia' | 'aguardando' | 'pendente';
  netOwed: number;
  pendingFromMe: number;
};

export function BalanceCard({ status, netOwed, pendingFromMe }: Props) {
  const tone =
    status === 'em_dia' ? 'success' : status === 'aguardando' ? 'warn' : 'danger';
  const label =
    status === 'em_dia'
      ? 'Você está em dia'
      : status === 'aguardando'
        ? 'Pagamento aguardando confirmação'
        : 'Há valores pendentes';

  return (
    <Card style={styles.card}>
      <Badge text={label} tone={tone} />
      <Text style={styles.amount}>{formatCurrency(netOwed)}</Text>
      <Text style={styles.caption}>
        {status === 'em_dia'
          ? 'Nenhum valor em aberto nesta viagem.'
          : pendingFromMe > 0
            ? `${formatCurrency(pendingFromMe)} aguardando consolidação.`
            : 'Registre um pagamento para quitar (comprovante opcional).'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    backgroundColor: colors.financeSoft,
    borderColor: colors.border,
  },
  amount: {
    ...typography.number,
    marginTop: spacing.xs,
  },
  caption: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.ui,
  },
});
