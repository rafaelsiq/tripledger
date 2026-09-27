import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
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
import { Body, Button, Label, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { memberLabel } from '@/src/lib/members';
import { confirmAction } from '@/src/lib/notify';
import { itemKind } from '@/src/lib/itineraryStory';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import { useLayout } from '@/src/hooks/useLayout';
import {
  canManageItineraryItem,
  countVotes,
  deleteItineraryItem,
  setItemVote,
  subscribeDayItem,
  toggleItemDone,
} from '@/src/services/itinerary';
import type { ItineraryItem, ItineraryVoteValue } from '@/src/types';
import { ITINERARY_ITEM_KIND_LABELS, ITINERARY_VOTE_LABELS } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

const VOTE_OPTIONS: {
  value: ItineraryVoteValue;
  hint: string;
  tone: 'yes' | 'maybe' | 'no';
}[] = [
  { value: 'yes', hint: 'Curti — quero esse rolê', tone: 'yes' },
  { value: 'maybe', hint: 'Tanto faz, vou no fluxo', tone: 'maybe' },
  { value: 'no', hint: 'Prefiro outra coisa', tone: 'no' },
];

type Popup = 'none' | 'menu' | 'vote' | 'results';

export default function ItineraryItemDetailScreen() {
  const { itemId, dayId } = useLocalSearchParams<{ itemId: string; dayId?: string }>();
  const router = useRouter();
  const { trip, members, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user } = useAuth();
  const { isWide } = useLayout();
  const { showError, showSuccess } = useToast();
  const [item, setItem] = useState<ItineraryItem | null>(null);
  const [voting, setVoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [popup, setPopup] = useState<Popup>('none');

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

  function openFromMenu(next: Popup) {
    setPopup(next);
  }

  async function onVote(vote: ItineraryVoteValue) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const removing = myVote === vote;
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
        removing ? 'Voto removido' : 'Voto registrado',
        removing
          ? 'Você pode votar de novo quando quiser.'
          : ITINERARY_VOTE_LABELS[vote]
      );
      if (removing) {
        setPopup('none');
      } else {
        // Close vote popup first, then open placar as the next popup.
        setPopup('none');
        setTimeout(() => setPopup('results'), 180);
      }
    } catch (e) {
      showError(e, 'Falha ao votar');
    } finally {
      setVoting(false);
    }
  }

  async function onToggleDone() {
    setPopup('none');
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
    setPopup('none');
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
    setPopup('none');
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
          headerRight: () => (
            <Pressable
              onPress={() => setPopup('menu')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Abrir menu da atividade"
              style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <TripClosedBanner
          trip={currentTrip}
          isAdmin={isAdmin}
          isFinanceLead={isFinanceLead}
        />

        {currentItem.imageUrl ? (
          <Image
            source={{ uri: currentItem.imageUrl }}
            style={[styles.hero, !isWide && styles.heroMobile]}
          />
        ) : (
          <View style={[styles.hero, !isWide && styles.heroMobile, styles.heroFallback]}>
            <Text style={[styles.heroLetter, !isWide && styles.heroLetterMobile]}>
              {currentItem.title.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.header}>
          {currentItem.time || currentItem.endTime ? (
            <View style={styles.scheduleBlock}>
              {itemKind(currentItem) === 'rest' ? (
                <>
                  {currentItem.time ? (
                    <Text style={[styles.time, styles.timeRest]}>
                      Início {currentItem.time}
                    </Text>
                  ) : null}
                  {currentItem.endTime ? (
                    <Text style={[styles.time, styles.timeRest]}>
                      Fim {currentItem.endTime}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  {currentItem.time ? (
                    <Text style={styles.time}>Ida {currentItem.time}</Text>
                  ) : null}
                  {currentItem.endTime ? (
                    <Text style={styles.time}>Volta à estadia {currentItem.endTime}</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
          <Text style={styles.kindLabel}>
            {ITINERARY_ITEM_KIND_LABELS[itemKind(currentItem)]}
          </Text>
          <Text style={[styles.title, !isWide && styles.titleMobile]}>{currentItem.title}</Text>
          {currentItem.location ? (
            <Text style={styles.location}>{currentItem.location}</Text>
          ) : null}
          {currentItem.description ? (
            <Body muted>{currentItem.description}</Body>
          ) : null}
          {myVote ? (
            <Text style={styles.voteStatus}>
              Seu voto: {ITINERARY_VOTE_LABELS[myVote]}
              {counts ? ` · ${counts.total}/${totalMembers} votos` : ''}
            </Text>
          ) : null}
          {currentItem.mapUrl ? (
            <Button
              title="Abrir no mapa"
              variant="secondary"
              onPress={() => Linking.openURL(currentItem.mapUrl!)}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Page actions menu */}
      <Modal
        visible={popup === 'menu'}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup('none')}
      >
        <Pressable style={[styles.backdrop, !isWide && styles.backdropMobile]} onPress={() => setPopup('none')}>
          <Pressable
            style={[styles.sheet, !isWide && styles.sheetMobile]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Label>Opções</Label>
              <Pressable onPress={() => setPopup('none')} hitSlop={10} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.inkMuted} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => openFromMenu('vote')}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Ionicons name="thumbs-up-outline" size={20} color={colors.accent} />
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>
                  {myVote ? 'Alterar voto' : 'Votar com o grupo'}
                </Text>
                <Text style={styles.menuHint}>Topa, talvez ou não topa</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => openFromMenu('results')}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Ionicons name="stats-chart-outline" size={20} color={colors.accent} />
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>Ver placar</Text>
                <Text style={styles.menuHint}>
                  {counts
                    ? `${counts.total} de ${totalMembers} já votaram`
                    : 'Resultado do grupo'}
                </Text>
              </View>
            </Pressable>

            {canMutate ? (
              <Pressable
                onPress={onToggleDone}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              >
                <Ionicons
                  name={currentItem.done ? 'refresh-outline' : 'checkmark-circle-outline'}
                  size={20}
                  color={colors.accent}
                />
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>
                    {currentItem.done ? 'Desmarcar como feito' : 'Marcar como feito'}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {canManage ? (
              <Pressable
                onPress={onEdit}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              >
                <Ionicons name="create-outline" size={20} color={colors.accent} />
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>Editar</Text>
                </View>
              </Pressable>
            ) : null}

            {canManage ? (
              <Pressable
                onPress={onDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                  deleting && { opacity: 0.55 },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <View style={styles.menuText}>
                  <Text style={[styles.menuLabel, { color: colors.danger }]}>Excluir</Text>
                </View>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Vote popup */}
      <Modal
        visible={popup === 'vote'}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup('none')}
      >
        <Pressable style={[styles.backdrop, !isWide && styles.backdropMobile]} onPress={() => setPopup('none')}>
          <Pressable
            style={[styles.sheet, !isWide && styles.sheetMobile]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Label>O grupo topa esse rolê?</Label>
              <Pressable onPress={() => setPopup('none')} hitSlop={10} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.inkMuted} />
              </Pressable>
            </View>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Placar popup — primarily after vote */}
      <Modal
        visible={popup === 'results'}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup('none')}
      >
        <Pressable style={[styles.backdrop, !isWide && styles.backdropMobile]} onPress={() => setPopup('none')}>
          <Pressable
            style={[styles.sheet, !isWide && styles.sheetMobile]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Label>Placar do grupo</Label>
              <Pressable onPress={() => setPopup('none')} hitSlop={10} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.inkMuted} />
              </Pressable>
            </View>
            <ScrollView
              style={!isWide ? styles.sheetScroll : undefined}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
            <Body muted>
              {counts ? `${counts.total} de ${totalMembers} já votaram` : 'Ainda sem votos'}
            </Body>
            {VOTE_OPTIONS.map((option) => {
              const count = counts?.[option.value] ?? 0;
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
            <Button
              title="Alterar meu voto"
              variant="secondary"
              onPress={() => setPopup('vote')}
            />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  hero: {
    width: '100%',
    height: 220,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceMuted,
  },
  heroMobile: {
    height: 160,
    borderRadius: radii.lg,
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
  heroLetterMobile: {
    fontSize: 48,
  },
  header: { gap: spacing.sm },
  scheduleBlock: { gap: 2 },
  time: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timeRest: {
    color: colors.finance,
  },
  kindLabel: {
    color: colors.inkSoft,
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 24,
  },
  location: {
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  voteStatus: {
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdropMobile: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sheetMobile: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  menuItemPressed: { opacity: 0.88 },
  menuText: { flex: 1, gap: 2 },
  menuLabel: {
    color: colors.ink,
    fontFamily: fonts.uiBold,
    fontSize: 15,
  },
  menuHint: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
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
