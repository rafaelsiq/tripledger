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
  /** Caption above the total (defaults to the trip-wide wording). */
  title?: string;
};

export function PaymentTimeline({ total, paid, payments, members, title = 'Total lançado' }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const progress = total > 0 ? Math.min(1, paid / total) : 0;
  const pending = payments
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + p.amount, 0);
  const pendingShare = total > 0 ? Math.min(1 - progress, pending / total) : 0;
  const open = Math.max(0, total - paid - pending);

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
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text style={styles.label}>{title}</Text>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
        </View>
        <Text style={styles.pct}>{Math.round(progress * 100)}% pago</Text>
      </View>

      <View style={styles.track}>
        <View style={styles.fillRow}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          <View style={[styles.fillPending, { width: `${pendingShare * 100}%` }]} />
        </View>
        {markers.map(({ payment, left }) => (
          <Pressable
            key={payment.id}
            onPress={() => setSelected(payment.id === selected ? null : payment.id)}
            style={[
              styles.marker,
              {
                left: `${Math.min(96, Math.max(2, left))}%`,
                backgroundColor:
                  payment.status === 'confirmed' ? colors.accentDark : colors.warnStrong,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.accent} text={`Pago ${formatCurrency(paid)}`} />
        {pending > 0 ? (
          <LegendItem color={colors.warnStrong} text={`Aguardando ${formatCurrency(pending)}`} />
        ) : null}
        <LegendItem color={colors.border} text={`Aberto ${formatCurrency(open)}`} />
      </View>
      {markers.length > 0 ? (
        <Caption>Toque nos pontos para ver quem pagou e quando</Caption>
      ) : null}

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

function LegendItem({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fonts.uiSemi,
  },
  total: {
    fontFamily: fonts.uiHeavy,
    fontSize: 28,
    letterSpacing: -0.6,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  pct: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.success,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
  },
  fillRow: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  fillPending: {
    height: '100%',
    backgroundColor: colors.warnStrong,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: 4,
  },
  tooltip: {
    backgroundColor: colors.ink,
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
