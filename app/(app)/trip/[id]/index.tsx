import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Body, Button, Card, Label, Screen } from '@/src/components/ui';
import { BalanceCard } from '@/src/components/finance/BalanceCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { memberBalance } from '@/src/lib/finance';
import { updateTripPhase } from '@/src/services/trips';
import { PHASE_LABELS } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';
import { formatCurrency } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

export default function TripSummaryScreen() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { trip, expenses, payments, isAdmin } = useTrip();

  const balance = useMemo(() => {
    if (!user) return null;
    return memberBalance(user.uid, expenses, payments);
  }, [user, expenses, payments]);

  const spent = expenses
    .filter((e) => e.kind !== 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  if (!trip || !balance) return null;

  async function setPhase(phase: 'planning' | 'active' | 'closed') {
    try {
      await updateTripPhase(trip!.id, phase);
      showSuccess('Fase atualizada', PHASE_LABELS[phase]);
    } catch (e) {
      showError(e, 'Não foi possível atualizar a fase');
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Badge text={PHASE_LABELS[trip.phase]} tone="accent" />
          <Text style={styles.title}>{trip.name}</Text>
          {trip.destination ? <Body muted>{trip.destination}</Body> : null}
          <Text style={styles.dates}>
            {trip.startDate} → {trip.endDate}
          </Text>
        </View>

        <BalanceCard
          status={balance.status}
          netOwed={balance.netOwed}
          pendingFromMe={balance.pendingFromMe}
        />

        <Card style={styles.stats}>
          <Label>Orçamento</Label>
          <View style={styles.statRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>Planejado</Text>
              <Text style={styles.statValue}>{formatCurrency(trip.budgetTotal)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>Lançado</Text>
              <Text style={styles.statValue}>{formatCurrency(spent)}</Text>
            </View>
          </View>
          {trip.budgetTotal > 0 && spent > trip.budgetTotal ? (
            <Badge text="Atenção: orçamento estourado" tone="warn" />
          ) : null}
        </Card>

        <Card>
          <Label>Convite</Label>
          <Text style={styles.code}>{trip.inviteCode}</Text>
          <Body muted>Compartilhe este código para novos membros entrarem.</Body>
        </Card>

        {isAdmin ? (
          <Card style={{ gap: spacing.sm }}>
            <Label>Fase da viagem</Label>
            <Button title="Planejamento" variant="secondary" onPress={() => setPhase('planning')} />
            <Button title="Em execução" variant="secondary" onPress={() => setPhase('active')} />
            <Button title="Concluir" variant="finance" onPress={() => setPhase('closed')} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.xs },
  title: { ...typography.title, fontSize: 28 },
  dates: { color: colors.inkMuted, marginTop: 4 },
  stats: { gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statLabel: { color: colors.inkSoft, fontSize: 13 },
  statValue: { ...typography.number, fontSize: 22 },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.accentDark,
    marginVertical: spacing.sm,
  },
});
