import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { confirmAction } from '@/src/lib/notify';
import { removeMember, transferFinanceLead } from '@/src/services/trips';
import { colors, fonts, spacing } from '@/src/theme';

export default function MembersScreen() {
  const { trip, members, isAdmin } = useTrip();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  if (!trip || !user) return null;

  async function onTransfer(uid: string, name: string) {
    const ok = await confirmAction({
      title: 'Transferir responsável financeiro',
      message: `Passar o cargo para ${name}?`,
      confirmText: 'Transferir',
    });
    if (!ok) return;
    try {
      await transferFinanceLead(trip!.id, uid);
      showSuccess('Responsável financeiro atualizado', name);
    } catch (e) {
      showError(e, 'Falha ao transferir');
    }
  }

  async function onRemove(uid: string, name: string) {
    if (uid === trip!.adminUid) {
      showError('Não é possível remover o administrador.', 'Ação bloqueada');
      return;
    }
    const ok = await confirmAction({
      title: 'Remover membro',
      message: `Remover ${name} da viagem?`,
      confirmText: 'Remover',
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeMember(trip!.id, uid);
      showSuccess('Membro removido', name);
    } catch (e) {
      showError(e, 'Falha ao remover');
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Membros ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyState title="Sem membros" />}
        renderItem={({ item }) => {
          const isFinance = item.uid === trip.financeLeadUid;
          return (
            <Card style={styles.card}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.badges}>
                  {item.role === 'admin' ? <Badge text="Admin" tone="accent" /> : null}
                  {isFinance ? <Badge text="Resp. financeiro" tone="warn" /> : null}
                  {item.role === 'member' && !isFinance ? (
                    <Badge text="Membro" tone="neutral" />
                  ) : null}
                </View>
              </View>
              {isAdmin ? (
                <View style={{ gap: spacing.sm, minWidth: 140 }}>
                  {!isFinance ? (
                    <Button
                      title="Tornar financeiro"
                      variant="secondary"
                      onPress={() => onTransfer(item.uid, item.displayName)}
                    />
                  ) : null}
                  {item.uid !== user.uid ? (
                    <Button
                      title="Remover"
                      variant="danger"
                      onPress={() => onRemove(item.uid, item.displayName)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  name: { fontFamily: fonts.uiBold, color: colors.ink, fontSize: 16 },
  email: { color: colors.inkSoft, fontSize: 13, fontFamily: fonts.ui },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
