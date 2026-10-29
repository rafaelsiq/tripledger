import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Notice } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { confirmAction } from '@/src/lib/notify';
import {
  clearPhasePromptSnooze,
  closedTripManagerMessage,
  closedTripMemberMessage,
  getPhasePrompt,
  isPhasePromptSnoozed,
  normalizeTripPhase,
  snoozePhasePrompt,
  type PhasePrompt,
} from '@/src/lib/tripPhase';
import { updateTripPhase } from '@/src/services/trips';
import type { Trip } from '@/src/types';
import { spacing } from '@/src/theme';

type PromptProps = {
  trip: Trip;
  adminUid: string;
  currentUid?: string | null;
  compact?: boolean;
};

/** Date-window prompt for the trip admin only. */
export function TripPhasePromptBanner({ trip, adminUid, currentUid, compact }: PromptProps) {
  const { showError, showSuccess } = useToast();
  const [prompt, setPrompt] = useState<PhasePrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = !!currentUid && currentUid === adminUid;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAdmin) {
        if (!cancelled) setPrompt(null);
        return;
      }
      const next = getPhasePrompt(trip);
      if (!next) {
        if (!cancelled) setPrompt(null);
        return;
      }
      const snoozed = await isPhasePromptSnoozed(trip.id, next.to);
      if (!cancelled) setPrompt(snoozed ? null : next);
    })().catch(() => {
      if (!cancelled) setPrompt(null);
    });
    return () => {
      cancelled = true;
    };
  }, [trip, isAdmin]);

  if (!isAdmin || !prompt) return null;

  async function onConfirm() {
    if (!currentUid || !prompt) return;
    const ok = await confirmAction({
      title: prompt.actionLabel,
      message: prompt.message,
      confirmText: prompt.actionLabel,
    });
    if (!ok) return;
    try {
      setLoading(true);
      await updateTripPhase(trip.id, prompt.to, currentUid);
      await clearPhasePromptSnooze(trip.id, prompt.to);
      showSuccess('Status atualizado', prompt.actionLabel);
      setPrompt(null);
    } catch (e) {
      showError(e, 'Não foi possível atualizar o status');
    } finally {
      setLoading(false);
    }
  }

  async function onSnooze() {
    if (!prompt) return;
    await snoozePhasePrompt(trip.id, prompt.to);
    setPrompt(null);
  }

  return (
    <View style={compact ? styles.compact : undefined}>
      <Notice tone="info" icon="calendar-outline" title={prompt.title} message={prompt.message}>
        <View style={styles.actions}>
          <Button
            title={prompt.actionLabel}
            size="sm"
            onPress={onConfirm}
            loading={loading}
          />
          <Button
            title="Agora não"
            size="sm"
            variant="ghost"
            onPress={onSnooze}
            disabled={loading}
          />
        </View>
      </Notice>
    </View>
  );
}

type ClosedProps = {
  trip: Trip;
  isAdmin: boolean;
  isFinanceLead: boolean;
};

/** Closed-trip notice: warn managers, inform blocked members. */
export function TripClosedBanner({ trip, isAdmin, isFinanceLead }: ClosedProps) {
  if (normalizeTripPhase(trip.phase) !== 'closed') return null;
  const manager = isAdmin || isFinanceLead;
  return (
    <Notice
      tone={manager ? 'warn' : 'neutral'}
      icon={manager ? 'alert-circle-outline' : 'lock-closed-outline'}
      title={manager ? 'Viagem concluída.' : 'Somente leitura.'}
      message={manager ? closedTripManagerMessage() : closedTripMemberMessage()}
    />
  );
}

const styles = StyleSheet.create({
  compact: {
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: 30 },
});
