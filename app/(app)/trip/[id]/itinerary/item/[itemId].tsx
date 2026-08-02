import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Body, Button, Card, Label, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { memberLabel } from '@/src/lib/members';
import { confirmAction } from '@/src/lib/notify';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  canManageItineraryItem,
  countVotes,
  deleteItineraryItem,
  setItemVote,
  subscribeDayItem,
  toggleItemDone,
} from '@/src/services/itinerary';
import type { ItineraryItem, ItineraryVoteValue } from '@/src/types';
import { ITINERARY_VOTE_LABELS } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

const VOTE_OPTIONS: {
  value: ItineraryVoteValue;
  hint: string;
  tone: 'yes' | 'maybe' | 'no';
}[] = [
  { value: 'yes', hint: 'Curti — quero esse rolê', tone: 'yes' },
  { value: 'maybe', hint: 'Tanto faz, vou no fluxo', tone: 'maybe' },
  { value: 'no', hint: 'Prefiro outra coisa', tone: 'no' },
];

export default function ItineraryItemDetailScreen() {
  const { itemId, dayId } = useLocalSearchParams<{ itemId: string; dayId?: string }>();
  const router = useRouter();
  const { trip, members, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [item, setItem] = useState<ItineraryItem | null>(null);
  const [voting, setVoting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resolvedDayId = dayId || item?.dayId;

  useEffect(() => {
    if (!trip || !resolvedDayId || !itemId) return;
    return subscribeDayItem(trip.id, String(resolvedDayId), String(itemId), setItem);
  }, [trip, resolvedDayId, itemId]);

  const canManage = useMemo(
    () =>
      !!user &&
      !!item &&
      canMutate &&
      canManageItineraryItem(item, { uid: user.uid, isAdmin }),
    [user, item, canMutate, isAdmin]
  );

  const counts = useMemo(() => (item ? countVotes(item) : null), [item]);
  const myVote = user && item ? item.votes?.[user.uid] : undefined;

  const votersByChoice = useMemo(() => {
    const groups: Record<ItineraryVoteValue, string[]> = {
      yes: [],
      maybe: [],
      no: [],
    };
    if (!item) return groups;
    const votes = item.votes || {};
    for (const [uid, value] of Object.entries(votes)) {
      if (value === 'yes' || value === 'maybe' || value === 'no') {
        groups[value].push(uid);
      }
    }
    for (const uid of item.attendees || []) {
      if (!votes[uid]) groups.yes.push(uid);
    }
    return groups;
  }, [item]);

  if (!trip || !user) return null;
  if (!item || !resolvedDayId) {
    return (
      <Screen>
        <Body muted>Atividade não encontrada.</Body>
      </Screen>
    );
  }

  const currentTrip = trip;
  const currentUser = user;
  const currentItem = item;
  const currentDayId = String(resolvedDayId);
  const totalMembers = Math.max(members.length, 1);

  function nameOf(uid: string) {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  }

  async function onVote(vote: ItineraryVoteValue) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    try {
      setVoting(true);
      await setItemVote({
        tripId: currentTrip.id,
        dayId: currentDayId,
        item: currentItem,
        uid: currentUser.uid,
        vote,
      });
      showSuccess(
        myVote === vote ? 'Voto removido' : 'Voto registrado',
        myVote === vote
          ? 'Você pode votar de novo quando quiser.'
          : ITINERARY_VOTE_LABELS[vote]
      );
    } catch (e) {
      showError(e, 'Falha ao votar');
    } finally {
      setVoting(false);
    }
  }

  async function onToggleDone() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    try {
      await toggleItemDone(
        currentTrip.id,
        currentDayId,
        currentItem.id,
        !currentItem.done
      );
      showSuccess(currentItem.done ? 'Desmarcado' : 'Marcado como feito');
    } catch (e) {
      showError(e, 'Falha ao atualizar');
    }
  }

  function onEdit() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (!canManage) {
      showError('Apenas o autor ou o administrador podem editar.', 'Sem permissão');
      return;
    }
    router.push({
      pathname: `/(app)/trip/${currentTrip.id}/itinerary/edit-item` as never,
      params: { dayId: currentDayId, itemId: currentItem.id },
    });
  }

  async function onDelete() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (!canManage) {
      showError('Apenas o autor ou o administrador podem excluir.', 'Sem permissão');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Excluir atividade',
      message: `Remover "${currentItem.title}" do roteiro? Os votos desta atividade também serão apagados.`,
      confirmText: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      setDeleting(true);
      await deleteItineraryItem({
        tripId: currentTrip.id,
        dayId: currentDayId,
        item: currentItem,
        actorUid: currentUser.uid,
      });
      showSuccess('Atividade excluída');
      router.back();
    } catch (e) {
      showError(e, 'Falha ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Atividade',
          headerRight: canManage
            ? () => (
                <Pressable
                  onPress={onEdit}
                  hitSlop={10}
                  style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.accent} />
                  <Text style={styles.headerActionText}>Editar</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner
          trip={currentTrip}
          isAdmin={isAdmin}
          isFinanceLead={isFinanceLead}
        />

        {currentItem.imageUrl ? (
          <Image source={{ uri: currentItem.imageUrl }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <Text style={styles.heroLetter}>
              {currentItem.title.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.header}>
          {currentItem.time ? <Text style={styles.time}>{currentItem.time}</Text> : null}
          <Text style={styles.title}>{currentItem.title}</Text>
          {currentItem.location ? (
            <Text style={styles.location}>{currentItem.location}</Text>
          ) : null}
          {currentItem.description ? (
            <Body muted>{currentItem.description}</Body>
          ) : null}
          {currentItem.mapUrl ? (
            <Button
              title="Abrir no mapa"
              variant="secondary"
              onPress={() => Linking.openURL(currentItem.mapUrl!)}
            />
          ) : null}
        </View>

        <Card style={styles.voteCard}>
          <Label>O grupo topa esse rolê?</Label>
          <Body muted>
            Vote para o time decidir juntos. Toque de novo no seu voto para remover.
          </Body>
          <View style={styles.voteRow}>
            {VOTE_OPTIONS.map((option) => {
              const selected = myVote === option.value;
              return (
                <Pressable
                  key={option.value}
                  disabled={voting || !canMutate}
                  onPress={() => onVote(option.value)}
                  style={({ pressed }) => [
                    styles.voteBtn,
                    styles[`vote_${option.tone}`],
                    selected && styles.voteBtnOn,
                    pressed && { opacity: 0.9 },
                    (!canMutate || voting) && { opacity: 0.55 },
                  ]}
                >
                  <Text style={[styles.voteBtnTitle, selected && styles.voteBtnTitleOn]}>
                    {ITINERARY_VOTE_LABELS[option.value]}
                  </Text>
                  <Text style={[styles.voteBtnHint, selected && styles.voteBtnHintOn]}>
                    {option.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {counts ? (
          <Card style={styles.resultsCard}>
            <Label>Placar do grupo</Label>
            <Body muted>
              {counts.total} de {totalMembers} já votaram
            </Body>
            {VOTE_OPTIONS.map((option) => {
              const count = counts[option.value];
              const width: DimensionValue = `${Math.max(4, (count / totalMembers) * 100)}%`;
              return (
                <View key={option.value} style={styles.barBlock}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>{ITINERARY_VOTE_LABELS[option.value]}</Text>
                    <Text style={styles.barCount}>{count}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        styles[`fill_${option.tone}`],
                        { width },
                      ]}
                    />
                  </View>
                  {votersByChoice[option.value].length ? (
                    <Text style={styles.voterNames}>
                      {votersByChoice[option.value].map(nameOf).join(' · ')}
                    </Text>
                  ) : (
                    <Text style={styles.voterNames}>Ninguém ainda</Text>
                  )}
                </View>
              );
            })}
          </Card>
        ) : null}

        {canMutate ? (
          <Button
            title={currentItem.done ? 'Desmarcar como feito' : 'Marcar como feito'}
            variant={currentItem.done ? 'secondary' : 'primary'}
            onPress={onToggleDone}
          />
        ) : null}

        {canManage ? (
          <View style={styles.deleteBlock}>
            <Body muted>Remove a atividade e os votos ligados a ela.</Body>
            <Button
              title="Excluir atividade"
              variant="danger"
              onPress={onDelete}
              loading={deleting}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerActionText: {
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    fontSize: 14,
  },
  deleteBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  hero: {
    width: '100%',
    height: 220,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceMuted,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  heroLetter: {
    color: colors.accent,
    fontSize: 64,
    fontFamily: fonts.displayBold,
  },
  header: { gap: spacing.sm },
  time: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.5,
  },
  location: {
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  voteCard: { gap: spacing.sm },
  voteRow: { gap: spacing.sm },
  voteBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  vote_yes: {},
  vote_maybe: {},
  vote_no: {},
  voteBtnOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  voteBtnTitle: {
    color: colors.ink,
    fontFamily: fonts.uiBold,
    fontSize: 16,
  },
  voteBtnTitleOn: { color: colors.accentDark },
  voteBtnHint: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  voteBtnHintOn: { color: colors.accentDark },
  resultsCard: { gap: spacing.md },
  barBlock: { gap: 6 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: { color: colors.ink, fontFamily: fonts.uiSemi, fontSize: 13 },
  barCount: { color: colors.inkSoft, fontFamily: fonts.uiBold, fontSize: 13 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  fill_yes: { backgroundColor: colors.accent },
  fill_maybe: { backgroundColor: colors.warn },
  fill_no: { backgroundColor: colors.danger },
  voterNames: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 16,
  },
});
