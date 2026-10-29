import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InviteShareCard } from '@/src/components/InviteShareCard';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  SectionHeader,
} from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { isDummyMember } from '@/src/lib/members';
import { confirmAction } from '@/src/lib/notify';
import { closedTripMemberMessage } from '@/src/lib/tripPhase';
import {
  createDummyMember,
  linkDummyToRealMember,
  removeMember,
  transferFinanceLead,
} from '@/src/services/trips';
import type { TripMember } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function MembersScreen() {
  const { trip, members, isAdmin, isFinanceLead, canMutate } = useTrip();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [dummyName, setDummyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [linkingUid, setLinkingUid] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [menuUid, setMenuUid] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const realMembers = useMemo(
    () => members.filter((m) => !isDummyMember(m)),
    [members]
  );
  const dummyMembers = useMemo(
    () => members.filter((m) => isDummyMember(m)),
    [members]
  );

  if (!trip || !user) return null;

  async function onCreateDummy() {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (!dummyName.trim()) {
      showError('Informe o nome do placeholder.', 'Campo obrigatório');
      return;
    }
    try {
      setCreating(true);
      const member = await createDummyMember({
        tripId: trip!.id,
        displayName: dummyName,
        actorUid: user!.uid,
      });
      setDummyName('');
      setShowCreate(false);
      showSuccess('Placeholder criado', member.displayName);
    } catch (e) {
      showError(e, 'Não foi possível criar o placeholder');
    } finally {
      setCreating(false);
    }
  }

  async function onTransfer(uid: string, name: string) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const ok = await confirmAction({
      title: 'Transferir responsável financeiro',
      message: `Passar o cargo para ${name}?`,
      confirmText: 'Transferir',
    });
    if (!ok) return;
    try {
      setBusyUid(uid);
      await transferFinanceLead(trip!.id, uid);
      showSuccess('Responsável financeiro atualizado', name);
    } catch (e) {
      showError(e, 'Falha ao transferir');
    } finally {
      setBusyUid(null);
    }
  }

  async function onRemove(member: TripMember) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    if (member.uid === trip!.adminUid) {
      showError('Não é possível remover o administrador.', 'Ação bloqueada');
      return;
    }
    const ok = await confirmAction({
      title: isDummyMember(member) ? 'Remover placeholder' : 'Remover membro',
      message: isDummyMember(member)
        ? `Remover “${member.displayName}”? Lançamentos ligados a este placeholder precisam ser tratados antes, se ainda existirem.`
        : `Remover ${member.displayName} da viagem?`,
      confirmText: 'Remover',
      destructive: true,
    });
    if (!ok) return;
    try {
      setBusyUid(member.uid);
      await removeMember(trip!.id, member.uid, user!.uid);
      showSuccess(isDummyMember(member) ? 'Placeholder removido' : 'Membro removido', member.displayName);
    } catch (e) {
      showError(e, 'Falha ao remover');
    } finally {
      setBusyUid(null);
    }
  }

  async function onLink(dummy: TripMember, real: TripMember) {
    if (!canMutate) {
      showError(closedTripMemberMessage(), 'Viagem concluída');
      return;
    }
    const ok = await confirmAction({
      title: 'Vincular placeholder',
      message: `Tudo que estava em “${dummy.displayName}” (despesas, pagamentos e acertos) passará para ${real.displayName}${
        real.email ? ` (${real.email})` : ''
      }, e o placeholder será removido.`,
      confirmText: 'Vincular',
    });
    if (!ok) return;
    try {
      setBusyUid(dummy.uid);
      await linkDummyToRealMember({
        tripId: trip!.id,
        dummyUid: dummy.uid,
        realUid: real.uid,
        actorUid: user!.uid,
      });
      setLinkingUid(null);
      showSuccess('Placeholder vinculado', real.displayName);
    } catch (e) {
      showError(e, 'Falha ao vincular');
    } finally {
      setBusyUid(null);
    }
  }

  const managers = members.filter((m) => m.role === 'admin' || m.uid === trip.financeLeadUid);
  const participants = members.filter((m) => !managers.includes(m));
  const canManage = isAdmin && canMutate;

  function roleLine(member: TripMember) {
    if (isDummyMember(member)) return 'Provisório · sem conta no app';
    const roles = [
      member.role === 'admin' ? 'Administrador' : null,
      member.uid === trip!.financeLeadUid ? 'Resp. financeiro' : null,
    ].filter(Boolean);
    return roles.length > 0 ? roles.join(' · ') : member.email || '—';
  }

  function renderMember(item: TripMember) {
    const isFinance = item.uid === trip!.financeLeadUid;
    const dummy = isDummyMember(item);
    const linking = linkingUid === item.uid;
    const menuOpen = menuUid === item.uid;
    const canTransfer = !dummy && !isFinance;
    const canRemove = item.uid !== user!.uid && item.uid !== trip!.adminUid;
    const hasMenu = canManage && (canTransfer || canRemove);
    const isYou = item.uid === user!.uid;

    return (
      <View key={item.uid}>
        <ListRow
          leading={<Avatar name={item.displayName} size={40} dashed={dummy} />}
          title={isYou ? `${item.displayName} (você)` : item.displayName}
          subtitle={roleLine(item)}
          trailing={
            <View style={styles.rowActions}>
              {canManage && dummy ? (
                <Button
                  title={linking ? 'Cancelar' : 'Vincular'}
                  variant="secondary"
                  size="sm"
                  onPress={() => setLinkingUid(linking ? null : item.uid)}
                  disabled={realMembers.length === 0}
                />
              ) : null}
              {hasMenu ? (
                <Pressable
                  onPress={() => setMenuUid(menuOpen ? null : item.uid)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ações para ${item.displayName}`}
                  accessibilityState={{ expanded: menuOpen }}
                  hitSlop={6}
                  style={styles.moreButton}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.inkSoft} />
                </Pressable>
              ) : null}
            </View>
          }
        />

        {menuOpen ? (
          <View style={styles.menu}>
            {canTransfer ? (
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceMuted }]}
                disabled={busyUid === item.uid}
                onPress={() => {
                  setMenuUid(null);
                  onTransfer(item.uid, item.displayName);
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={colors.ink} />
                <Text style={styles.menuText}>Tornar responsável financeiro</Text>
              </Pressable>
            ) : null}
            {canRemove ? (
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceMuted }]}
                disabled={busyUid === item.uid}
                onPress={() => {
                  setMenuUid(null);
                  onRemove(item);
                }}
              >
                <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                <Text style={[styles.menuText, { color: colors.danger }]}>
                  {dummy ? 'Remover provisório' : 'Remover da viagem'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {linking && realMembers.length > 0 ? (
          <View style={styles.linkBox}>
            <Text style={styles.linkHint}>
              Escolha a conta real que herda o que estava em “{item.displayName}”.
            </Text>
            {realMembers.map((real) => {
              const meta = [
                real.email || null,
                real.role === 'admin' ? 'Admin' : null,
                real.uid === trip!.financeLeadUid ? 'Resp. financeiro' : null,
                real.uid === user!.uid ? 'Você' : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={real.uid}
                  disabled={busyUid === item.uid}
                  onPress={() => onLink(item, real)}
                  style={({ pressed }) => [
                    styles.linkOption,
                    pressed && { backgroundColor: colors.surfaceMuted },
                    busyUid === item.uid && { opacity: 0.55 },
                  ]}
                >
                  <Avatar name={real.displayName} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkOptionName}>{real.displayName}</Text>
                    {meta ? <Text style={styles.linkOptionMeta}>{meta}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  const subtitle = `${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'}${
    dummyMembers.length > 0
      ? ` · ${dummyMembers.length} provisório${dummyMembers.length === 1 ? '' : 's'}`
      : ''
  }`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader title="Membros" subtitle={subtitle} />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        {members.length === 0 ? <EmptyState title="Sem membros" /> : null}

        {managers.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Gestão" />
            <ListGroup>{managers.map(renderMember)}</ListGroup>
          </View>
        ) : null}

        {participants.length > 0 || canManage ? (
          <View style={styles.section}>
            <SectionHeader title="Participantes" />
            {participants.length > 0 ? (
              <ListGroup>{participants.map(renderMember)}</ListGroup>
            ) : null}

            {canManage ? (
              showCreate ? (
                <Card style={styles.createCard}>
                  <Text style={styles.createTitle}>Membro provisório</Text>
                  <Text style={styles.linkHint}>
                    Para quem ainda não entrou no app. Lance despesas por essa pessoa e vincule à
                    conta real depois.
                  </Text>
                  <Input
                    label="Nome"
                    value={dummyName}
                    onChangeText={setDummyName}
                    placeholder="Giovanni"
                    autoFocus
                  />
                  <View style={styles.createActions}>
                    <Button
                      title="Cancelar"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        setShowCreate(false);
                        setDummyName('');
                      }}
                    />
                    <Button title="Adicionar" size="sm" onPress={onCreateDummy} loading={creating} />
                  </View>
                </Card>
              ) : (
                <Pressable
                  onPress={() => setShowCreate(true)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.addDashed,
                    pressed && { backgroundColor: colors.surface },
                  ]}
                >
                  <Ionicons name="add" size={18} color={colors.inkLabel} />
                  <Text style={styles.addDashedText}>Adicionar membro provisório</Text>
                </Pressable>
              )
            ) : null}
          </View>
        ) : null}

        {isAdmin ? (
          <InviteShareCard tripName={trip.name} inviteCode={trip.inviteCode} isAdmin />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  menu: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  menuText: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  linkBox: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  linkHint: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  linkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkOptionName: { fontFamily: fonts.uiBold, color: colors.ink, fontSize: 15 },
  linkOptionMeta: { fontFamily: fonts.ui, color: colors.inkSoft, fontSize: 12 },
  createCard: { gap: spacing.sm },
  createTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  addDashed: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addDashedText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.inkLabel },
});
