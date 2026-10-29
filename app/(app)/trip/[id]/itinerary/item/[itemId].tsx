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
import { Badge, Body, Button, Card, Label, Screen } from '@/src/components/ui';
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
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: 'yes' | 'maybe' | 'no';
  countLabel: string;
}[] = [
  { value: 'yes', icon: 'thumbs-up', tone: 'yes', countLabel: 'topa' },
  { value: 'maybe', icon: 'help', tone: 'maybe', countLabel: 'talvez' },
  { value: 'no', icon: 'thumbs-down', tone: 'no', countLabel: 'não topa' },
];

const TONE_COLOR: Record<'yes' | 'maybe' | 'no', string> = {
  yes: colors.success,
  maybe: colors.warn,
  no: colors.danger,
};

/** Above this many voters, the names under the placar start collapsed. */
const VOTER_NAMES_COLLAPSE_AT = 6;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);

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
  const isRest = itemKind(currentItem) === 'rest';
  const totalVotes = counts?.total ?? 0;
  const namesCollapsible = totalVotes > VOTER_NAMES_COLLAPSE_AT;
  const showNames = !namesCollapsible || namesOpen;

  function nameOf(uid: string) {
    const member = members.find((m) => m.uid === uid);
    return member ? memberLabel(member) : 'Membro';
  }

  const voteSummary = [
    myVote ? `Você votou: ${ITINERARY_VOTE_LABELS[myVote]}` : 'Você ainda não votou',
    VOTE_OPTIONS.filter((o) => (counts?.[o.value] ?? 0) > 0)
      .map((o) => `${counts![o.value]} ${o.countLabel}`)
      .join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  async function onVote(vote: ItineraryVoteValue) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    try {
      setVoting(true);
      // Tapping the current vote again removes it (toggle).
      await setItemVote({
        tripId: currentTrip.id,
        dayId: currentDayId,
        item: currentItem,
        uid: currentUser.uid,
        vote,
      });
    } catch (e) {
      showError(e, 'Falha ao votar');
    } finally {
      setVoting(false);
    }
  }

  async function onToggleDone() {
    setMenuOpen(false);
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
    setMenuOpen(false);
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
    setMenuOpen(false);
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
          headerRight: canMutate
            ? () => (
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir menu da atividade"
                  style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.accent} />
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
          <Image
            source={{ uri: currentItem.imageUrl }}
            style={[styles.hero, !isWide && styles.heroMobile]}
          />
        ) : (
          <View
            style={[
              styles.hero,
              !isWide && styles.heroMobile,
              styles.heroFallback,
              isRest && styles.heroFallbackRest,
            ]}
          >
            <Text
              style={[
                styles.heroLetter,
                !isWide && styles.heroLetterMobile,
                isRest && styles.heroLetterRest,
              ]}
            >
              {currentItem.title.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.badges}>
            <Badge
              text={ITINERARY_ITEM_KIND_LABELS[itemKind(currentItem)]}
              tone={isRest ? 'neutral' : 'accent'}
            />
            {currentItem.done ? <Badge text="Feita" tone="success" dot /> : null}
          </View>
          <Text style={[styles.title, !isWide && styles.titleMobile]}>{currentItem.title}</Text>
          {currentItem.time || currentItem.endTime ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={colors.inkSoft} />
              <Text style={styles.location}>
                {isRest
                  ? [currentItem.time, currentItem.endTime].filter(Boolean).join(' → ')
                  : [
                      currentItem.time ? `Saída ${currentItem.time}` : null,
                      currentItem.endTime ? `volta à estadia ${currentItem.endTime}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </Text>
            </View>
          ) : null}
          {currentItem.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={colors.inkSoft} />
              <Text style={styles.location}>{currentItem.location}</Text>
              {currentItem.mapUrl ? (
                <Pressable onPress={() => Linking.openURL(currentItem.mapUrl!)} hitSlop={8}>
                  <Text style={styles.link}>Abrir no mapa</Text>
                </Pressable>
              ) : null}
            </View>
          ) : currentItem.mapUrl ? (
            <Button
              title="Abrir no mapa"
              icon="map-outline"
              variant="secondary"
              size="sm"
              onPress={() => Linking.openURL(currentItem.mapUrl!)}
            />
          ) : null}
        </View>

        {!isRest ? (
          <Card style={styles.voteCard}>
            <View style={styles.voteHead}>
              <Text style={styles.voteTitle}>O grupo topa?</Text>
              <Text style={styles.voteProgress}>
                {totalVotes} de {totalMembers} votaram
              </Text>
            </View>

            <View style={styles.voteInline}>
              {VOTE_OPTIONS.map((option) => {
                const selected = myVote === option.value;
                const tint = selected ? colors.white : TONE_COLOR[option.tone];
                return (
                  <Pressable
                    key={option.value}
                    disabled={voting || !canMutate}
                    onPress={() => onVote(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityHint={selected ? 'Toque de novo para remover o voto' : undefined}
                    style={({ pressed }) => [
                      styles.voteChoice,
                      selected && styles[`choice_${option.tone}`],
                      pressed && { opacity: 0.9 },
                      (!canMutate || voting) && { opacity: 0.55 },
                    ]}
                  >
                    <Ionicons name={option.icon} size={16} color={tint} />
                    <Text style={[styles.voteChoiceLabel, selected && styles.voteChoiceLabelOn]}>
                      {ITINERARY_VOTE_LABELS[option.value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.voteSummary}>{voteSummary}</Text>

            <View style={styles.divider} />

            {VOTE_OPTIONS.map((option) => {
              const count = counts?.[option.value] ?? 0;
              const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
              const width: DimensionValue = `${count ? Math.max(4, pct) : 0}%`;
              const voters = votersByChoice[option.value];
              return (
                <View key={option.value} style={styles.barBlock}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>{ITINERARY_VOTE_LABELS[option.value]}</Text>
                    <Text style={styles.barCount}>
                      {count} · {pct}%
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, styles[`fill_${option.tone}`], { width }]} />
                  </View>
                  {showNames && voters.length ? (
                    <Text style={styles.voterNames}>{voters.map(nameOf).join(' · ')}</Text>
                  ) : null}
                </View>
              );
            })}

            {namesCollapsible ? (
              <Pressable
                onPress={() => setNamesOpen((open) => !open)}
                hitSlop={8}
                accessibilityRole="button"
                style={styles.namesToggle}
              >
                <Text style={styles.link}>{namesOpen ? 'Ocultar nomes' : 'Ver quem votou'}</Text>
                <Ionicons
                  name={namesOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.accent}
                />
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {currentItem.description ? (
          <View style={styles.about}>
            <Label>Sobre</Label>
            <Body muted>{currentItem.description}</Body>
          </View>
        ) : null}

        {canMutate ? (
          <Button
            title={currentItem.done ? 'Desmarcar como feita' : 'Marcar como feita'}
            icon={currentItem.done ? 'refresh-outline' : 'checkmark'}
            variant="secondary"
            onPress={onToggleDone}
          />
        ) : null}
      </ScrollView>

      {/* Page actions menu: votes and placar live inline above. */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={[styles.backdrop, !isWide && styles.backdropMobile]} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={[styles.sheet, !isWide && styles.sheetMobile]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Label>Opções</Label>
              <Pressable onPress={() => setMenuOpen(false)} hitSlop={10} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.inkMuted} />
              </Pressable>
            </View>

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
    aspectRatio: 16 / 9,
    maxHeight: 320,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceMuted,
  },
  heroMobile: {
    maxHeight: 200,
    borderRadius: radii.lg,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  heroFallbackRest: { backgroundColor: colors.financeSoft },
  heroLetter: {
    color: colors.accent,
    fontSize: 64,
    fontFamily: fonts.displayBold,
  },
  heroLetterMobile: {
    fontSize: 48,
  },
  heroLetterRest: { color: colors.inkSoft },
  header: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  link: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.accent },
  voteCard: { gap: 12 },
  voteHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  voteTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink },
  voteProgress: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkSoft },
  voteInline: { flexDirection: 'row', gap: spacing.sm },
  voteChoice: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  voteChoiceLabel: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.inkLabel },
  voteChoiceLabelOn: { color: colors.white },
  choice_yes: { borderColor: colors.success, backgroundColor: colors.success },
  choice_maybe: { borderColor: colors.warnStrong, backgroundColor: colors.warnStrong },
  choice_no: { borderColor: colors.danger, backgroundColor: colors.danger },
  voteSummary: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkSoft },
  divider: { height: 1, backgroundColor: colors.divider },
  about: { gap: 6 },
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
    ...shadows.raised,
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
  barBlock: { gap: 6 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: { color: colors.ink, fontFamily: fonts.uiSemi, fontSize: 13 },
  barCount: {
    color: colors.inkSoft,
    fontFamily: fonts.uiBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  fill_yes: { backgroundColor: colors.success },
  fill_maybe: { backgroundColor: colors.warnStrong },
  fill_no: { backgroundColor: colors.danger },
  voterNames: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 16,
  },
  namesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
