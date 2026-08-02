import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Card, Label } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { confirmAction } from '@/src/lib/notify';
import { clearPhasePromptSnooze, normalizeTripPhase, phaseLabel } from '@/src/lib/tripPhase';
import { updateTripPhase } from '@/src/services/trips';
import type { Trip, TripPhase } from '@/src/types';
import { TRIP_PHASES } from '@/src/types';
import { spacing } from '@/src/theme';

type Props = {
  trip: Trip;
  adminUid: string;
  currentUid?: string | null;
};

/**
 * Admin-only status control: one intentional confirm per change.
 * Replaces the always-visible three-button panel.
 */
export function TripPhaseAdminActions({ trip, adminUid, currentUid }: Props) {
  const { showError, showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<TripPhase | null>(null);

  if (!currentUid || currentUid !== adminUid) return null;

  const current = normalizeTripPhase(trip.phase);

  async function onSelect(phase: TripPhase) {
    if (phase === current || !currentUid) return;
    const ok = await confirmAction({
      title: 'Alterar status da viagem',
      message: `Mudar de “${phaseLabel(current)}” para “${phaseLabel(phase)}”?`,
      confirmText: 'Alterar',
    });
    if (!ok) return;
    try {
      setLoadingPhase(phase);
      await updateTripPhase(trip.id, phase, currentUid);
      await clearPhasePromptSnooze(trip.id, phase);
      showSuccess('Status atualizado', phaseLabel(phase));
      setOpen(false);
    } catch (e) {
      showError(e, 'Não foi possível alterar o status');
    } finally {
      setLoadingPhase(null);
    }
  }

  return (
    <Card style={styles.card}>
      <Label>Status</Label>
      <Body muted>
        Atual: {phaseLabel(current)}. Só o administrador pode alterar — com confirmação.
      </Body>
      {!open ? (
        <Button title="Alterar status" variant="secondary" onPress={() => setOpen(true)} />
      ) : (
        <View style={styles.options}>
          {TRIP_PHASES.map((phase) => (
            <Button
              key={phase}
              title={phaseLabel(phase)}
              variant={phase === current ? 'primary' : 'secondary'}
              disabled={phase === current || !!loadingPhase}
              loading={loadingPhase === phase}
              onPress={() => onSelect(phase)}
            />
          ))}
          <Button title="Cancelar" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  options: { gap: spacing.sm },
});
