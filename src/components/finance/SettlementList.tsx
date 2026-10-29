import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { memberLabel } from '@/src/lib/members';
import type { Settlement, TripMember } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { Button, ListGroup } from '@/src/components/ui';

type Props = {
  settlements: Settlement[];
  members: TripMember[];
  currentUid: string;
  canManage: boolean;
  onSettle: (settlement: Settlement) => void;
};

export function SettlementList({
  settlements,
  members,
  currentUid,
  canManage,
  onSettle,
}: Props) {
  const nameOf = (uid: string) => {
    if (uid === currentUid) return 'Você';
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  };

  if (settlements.length === 0) {
    return (
      <ListGroup>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhum acerto gerado ainda.</Text>
        </View>
      </ListGroup>
    );
  }

  return (
    <ListGroup>
      {settlements.map((s) => {
        const involved = s.fromUid === currentUid || s.toUid === currentUid;
        const settled = s.status === 'settled';
        const mine = s.fromUid === currentUid && !settled;
        return (
          <View key={s.id} style={[styles.row, settled && styles.rowSettled, mine && styles.rowMine]}>
            <Text style={[styles.title, settled && styles.settledText]} numberOfLines={2}>
              <Text style={styles.name}>{nameOf(s.fromUid)}</Text>
              {'  →  '}
              <Text style={styles.name}>{nameOf(s.toUid)}</Text>
            </Text>
            <Text style={[styles.amount, settled && { color: colors.inkSoft }]}>
              {formatCurrency(s.amount)}
            </Text>
            {settled ? (
              <Text style={styles.settledTag}>Quitado</Text>
            ) : involved || canManage ? (
              <Button
                title={mine ? 'Pagar' : 'Quitar'}
                variant={mine ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => onSettle(s)}
              />
            ) : (
              <Text style={styles.openTag}>Em aberto</Text>
            )}
          </View>
        );
      })}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 56,
  },
  rowSettled: { backgroundColor: colors.bg },
  rowMine: { backgroundColor: colors.warnSoft },
  title: { flex: 1, color: colors.ink, fontFamily: fonts.ui, fontSize: 14 },
  name: { fontFamily: fonts.uiBold },
  settledText: { color: colors.inkSoft, textDecorationLine: 'line-through' },
  amount: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  settledTag: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.success, minWidth: 62, textAlign: 'right' },
  openTag: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.warn, minWidth: 62, textAlign: 'right' },
  empty: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.inkSoft, fontFamily: fonts.ui },
});
