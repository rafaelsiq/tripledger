import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge, Body, Button, Card, EmptyState, PageHeader, Screen, Segmented } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import {
  catalogSourceLabel,
  setCatalogStatus,
  subscribeCatalogByStatus,
  subscribeIsCatalogCurator,
} from '@/src/services/catalog';
import type { ActivityCatalogEntry, ActivityCatalogStatus } from '@/src/types';
import { ACTIVITY_CATEGORY_LABELS } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

const TABS: { id: ActivityCatalogStatus; label: string }[] = [
  { id: 'pending', label: 'Em revisão' },
  { id: 'published', label: 'Publicados' },
  { id: 'rejected', label: 'Recusados' },
];

function sourceDetail(entry: ActivityCatalogEntry) {
  const when = entry.createdAt ? format(entry.createdAt, "d MMM", { locale: ptBR }) : null;
  if (entry.source === 'routine') return ['Rotina de atualização', entry.batchId ? `lote ${entry.batchId}` : when];
  if (entry.source === 'user') return ['Enviado por usuário', when];
  return ['Cadastro manual', when];
}

/** Step 4: review queue for catalog curators. Edits to content happen in the Firebase console. */
export default function CurationScreen() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [isCurator, setIsCurator] = useState<boolean | null>(null);
  const [tab, setTab] = useState<ActivityCatalogStatus>('pending');
  const [entries, setEntries] = useState<ActivityCatalogEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeIsCatalogCurator(user.uid, setIsCurator);
  }, [user]);

  useEffect(() => {
    if (!isCurator) return;
    setEntries([]);
    return subscribeCatalogByStatus(tab, setEntries);
  }, [isCurator, tab]);

  if (isCurator === null) return null;
  if (!isCurator) {
    return (
      <Screen>
        <EmptyState title="Só para curadores" subtitle="Peça a um curador para incluir sua conta." />
      </Screen>
    );
  }

  async function move(entry: ActivityCatalogEntry, status: ActivityCatalogStatus) {
    try {
      setBusyId(entry.id);
      await setCatalogStatus(entry.id, status);
      showSuccess(
        status === 'published' ? 'Publicado' : status === 'rejected' ? 'Recusado' : 'Voltou para revisão',
        entry.title
      );
    } catch (e) {
      showError(e, 'Falha ao atualizar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader title="Curadoria de rolês" subtitle="Só para curadores" />
        <Segmented
          options={TABS.map((t) => ({
            id: t.id,
            label: t.id === tab && entries.length ? `${t.label} · ${entries.length}` : t.label,
          }))}
          value={tab}
          onChange={setTab}
        />

        {entries.length === 0 ? (
          <EmptyState
            title={tab === 'pending' ? 'Nada para revisar' : 'Nada por aqui'}
            subtitle={tab === 'pending' ? 'Sugestões de usuários aparecem aqui.' : undefined}
          />
        ) : (
          entries.map((entry) => {
            const [origin, detail] = sourceDetail(entry);
            const busy = busyId === entry.id;
            return (
              <Card key={entry.id} style={styles.card}>
                <View style={styles.badges}>
                  <Badge text={origin!} tone={entry.source === 'user' ? 'info' : entry.source === 'routine' ? 'warn' : 'accent'} />
                  <Badge
                    text={`${entry.destinationName} · ${ACTIVITY_CATEGORY_LABELS[entry.category]}`}
                    tone="neutral"
                  />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={styles.title}>{entry.title}</Text>
                  {entry.description ? <Body muted>{entry.description}</Body> : null}
                  <Text style={styles.meta}>
                    {[catalogSourceLabel(entry), detail, entry.location].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {tab !== 'rejected' ? (
                    <View style={styles.action}>
                      <Button
                        title="Recusar"
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onPress={() => move(entry, 'rejected')}
                      />
                    </View>
                  ) : null}
                  {tab !== 'pending' ? (
                    <View style={styles.action}>
                      <Button
                        title="Revisar de novo"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onPress={() => move(entry, 'pending')}
                      />
                    </View>
                  ) : null}
                  {tab !== 'published' ? (
                    <View style={styles.action}>
                      <Button
                        title="Publicar"
                        size="sm"
                        loading={busy}
                        onPress={() => move(entry, 'published')}
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}

        <Text style={styles.footnote}>
          Para editar o texto de um rolê, altere o documento em activityCatalog no console do Firebase.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  card: { gap: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontFamily: fonts.uiHeavy, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkMuted },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  footnote: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, color: colors.inkMuted },
});
