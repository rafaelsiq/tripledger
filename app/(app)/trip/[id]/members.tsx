import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { InviteShareCard } from '@/src/components/InviteShareCard';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Badge, Body, Button, Card, EmptyState, Input, Label, Screen } from '@/src/components/ui';
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
      message: `Tudo que estava em “${dummy.displayName}” (despesas, pagamentos e acertos) passará para ${real.displayName}, e o placeholder será removido.`,
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

  return (
    <Screen>
      <Text style={styles.title}>Membros ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
            <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
            {isAdmin ? (
              <InviteShareCard
                tripName={trip.name}
                inviteCode={trip.inviteCode}
                isAdmin
              />
            ) : null}
            {isAdmin && canMutate ? (
              <Card style={styles.createCard}>
                <Label>Placeholder (membro provisório)</Label>
                <Body muted>
                  Use quando alguém ainda não entrou no app. Você lança despesas e pagamentos por
                  essa pessoa e, depois, vincula ao membro real.
                </Body>
                <Input
                  label="Nome"
                  value={dummyName}
                  onChangeText={setDummyName}
                  placeholder="Giovanni"
                />
                <Button
                  title="Criar placeholder"
                  variant="secondary"
                  onPress={onCreateDummy}
                  loading={creating}
                />
                {dummyMembers.length > 0 ? (
                  <Body muted>
                    {dummyMembers.length} placeholder{dummyMembers.length === 1 ? '' : 's'} ativo
                    {dummyMembers.length === 1 ? '' : 's'}.
                  </Body>
                ) : null}
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState title="Sem membros" />}
        renderItem={({ item }) => {
          const isFinance = item.uid === trip.financeLeadUid;
          const dummy = isDummyMember(item);
          const linking = linkingUid === item.uid;
          return (
            <Card style={styles.card}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.email}>
                  {dummy ? 'Sem conta no app' : item.email || '—'}
                </Text>
                <View style={styles.badges}>
                  {item.role === 'admin' ? <Badge text="Admin" tone="accent" /> : null}
                  {isFinance ? <Badge text="Resp. financeiro" tone="warn" /> : null}
                  {dummy ? <Badge text="Placeholder" tone="warn" /> : null}
                  {!dummy && item.role === 'member' && !isFinance ? (
                    <Badge text="Membro" tone="neutral" />
                  ) : null}
                </View>

                {linking && realMembers.length > 0 ? (
                  <View style={styles.linkBox}>
                    <Label>Vincular a</Label>
                    {realMembers.map((real) => (
                      <Button
                        key={real.uid}
                        title={real.displayName}
                        variant="secondary"
                        disabled={busyUid === item.uid}
                        loading={busyUid === item.uid}
                        onPress={() => onLink(item, real)}
                      />
                    ))}
                    <Button title="Cancelar" variant="ghost" onPress={() => setLinkingUid(null)} />
                  </View>
                ) : null}
              </View>

              {isAdmin && canMutate ? (
                <View style={{ gap: spacing.sm, minWidth: 140 }}>
                  {dummy ? (
                    <Button
                      title={linking ? 'Escolhendo…' : 'Vincular a membro'}
                      variant="secondary"
                      onPress={() => setLinkingUid(linking ? null : item.uid)}
                      disabled={realMembers.length === 0}
                    />
                  ) : null}
                  {!dummy && !isFinance ? (
                    <Button
                      title="Tornar financeiro"
                      variant="secondary"
                      onPress={() => onTransfer(item.uid, item.displayName)}
                      loading={busyUid === item.uid}
                    />
                  ) : null}
                  {item.uid !== user.uid ? (
                    <Button
                      title="Remover"
                      variant="danger"
                      onPress={() => onRemove(item)}
                      loading={busyUid === item.uid}
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
  createCard: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  name: { fontFamily: fonts.uiBold, color: colors.ink, fontSize: 16 },
  email: { color: colors.inkSoft, fontSize: 13, fontFamily: fonts.ui },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linkBox: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
});
