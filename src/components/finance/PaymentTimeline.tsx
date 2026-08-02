import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { memberLabel } from '@/src/lib/members';
import type { Payment, TripMember } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { Caption } from '@/src/components/ui';

type Props = {
  total: number;
  paid: number;
  payments: Payment[];
  members: TripMember[];
};

export function PaymentTimeline({ total, paid, payments, members }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const progress = total > 0 ? Math.min(1, paid / total) : 0;

  const markers = useMemo(() => {
    const confirmed = payments
      .filter((p) => p.status === 'confirmed' || p.status === 'pending')
      .slice()
      .sort((a, b) => a.paidAt - b.paidAt);

    if (confirmed.length === 0) return [];

    const min = confirmed[0]!.paidAt;
    const max = confirmed[confirmed.length - 1]!.paidAt;
    const span = Math.max(1, max - min);

    return confirmed.map((p) => ({
      payment: p,
      left: ((p.paidAt - min) / span) * 100,
    }));
  }, [payments]);

  const nameOf = (uid: string) => {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  const selectedPayment = payments.find((p) => p.id === selected);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>Progresso de pagamentos</Text>
        <Text style={styles.value}>
          {formatCurrency(paid)} / {formatCurrency(total)}
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        {markers.map(({ payment, left }) => (
          <Pressable
            key={payment.id}
            onPress={() => setSelected(payment.id === selected ? null : payment.id)}
            style={[
              styles.marker,
              {
                left: `${Math.min(96, Math.max(2, left))}%`,
                backgroundColor:
                  payment.status === 'confirmed' ? colors.accent : colors.warn,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <Caption>Toque nos pontos para ver quem pagou e quando</Caption>
      </View>

      {selectedPayment ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>
            {nameOf(selectedPayment.fromUid)} → {nameOf(selectedPayment.toUid)}
          </Text>
          <Text style={styles.tooltipBody}>
            {formatCurrency(selectedPayment.amount)} ·{' '}
            {format(selectedPayment.paidAt, "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
          </Text>
          <Text style={styles.tooltipStatus}>
            {selectedPayment.status === 'confirmed'
              ? 'Confirmado'
              : selectedPayment.status === 'pending'
                ? 'Aguardando consolidação'
                : 'Rejeitado'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fonts.uiSemi,
  },
  value: {
    color: colors.finance,
    fontSize: 13,
    fontFamily: fonts.uiBold,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.financeSoft,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    top: -2,
    borderWidth: 2,
    borderColor: colors.white,
  },
  legend: {
    marginTop: 4,
  },
  tooltip: {
    marginTop: spacing.sm,
    backgroundColor: colors.finance,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  tooltipTitle: {
    color: colors.white,
    fontFamily: fonts.uiBold,
    fontSize: 14,
  },
  tooltipBody: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  tooltipStatus: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fonts.ui,
    fontSize: 12,
    marginTop: 2,
  },
});
