import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Settlement, TripMember } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { Badge, Button } from '@/src/components/ui';

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
  const nameOf = (uid: string) =>
    members.find((m) => m.uid === uid)?.displayName || 'Membro';

  if (settlements.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum acerto pendente.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {settlements.map((s) => {
        const involved = s.fromUid === currentUid || s.toUid === currentUid;
        return (
          <View key={s.id} style={styles.row}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>
                {nameOf(s.fromUid)} deve {formatCurrency(s.amount)} a {nameOf(s.toUid)}
              </Text>
              <Badge
                text={s.status === 'settled' ? 'Quitado' : 'Em aberto'}
                tone={s.status === 'settled' ? 'success' : 'warn'}
              />
            </View>
            {s.status === 'open' && (involved || canManage) ? (
              <Button title="Quitar" variant="finance" onPress={() => onSettle(s)} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.uiSemi,
    fontSize: 14,
  },
  empty: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.inkSoft, fontFamily: fonts.ui },
});
