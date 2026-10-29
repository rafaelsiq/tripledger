import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, IconButton, Label } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import {
  buildInviteShareMessage,
  buildInviteShareUrl,
  normalizeInviteCode,
} from '@/src/lib/invite';
import { colors, fonts, spacing } from '@/src/theme';

type Props = {
  tripName: string;
  inviteCode: string;
  isAdmin?: boolean;
};

export function InviteShareCard({ tripName, inviteCode, isAdmin = false }: Props) {
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState<'code' | 'link' | 'share' | null>(null);

  const code = useMemo(() => normalizeInviteCode(inviteCode), [inviteCode]);
  const inviteUrl = useMemo(() => buildInviteShareUrl(code), [code]);

  if (!isAdmin) return null;

  async function copyCode() {
    try {
      setBusy('code');
      await Clipboard.setStringAsync(code);
      showSuccess('Código copiado', code);
    } catch (e) {
      showError(e, 'Não foi possível copiar o código');
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      setBusy('link');
      await Clipboard.setStringAsync(inviteUrl);
      showSuccess('Link copiado', 'Envie para o grupo entrar na viagem');
    } catch (e) {
      showError(e, 'Não foi possível copiar o link');
    } finally {
      setBusy(null);
    }
  }

  async function shareInvite() {
    const message = buildInviteShareMessage(tripName, code);
    try {
      setBusy('share');
      const canNativeShare =
        typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      if (canNativeShare) {
        await navigator.share({
          title: `Convite — ${tripName}`,
          text: message,
          url: inviteUrl,
        });
        return;
      }
      const result = await Share.share({
        message,
        url: inviteUrl,
        title: `Convite — ${tripName}`,
      });
      if (result.action === Share.dismissedAction) return;
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : '';
      if (/cancel|dismiss|AbortError/i.test(errMessage) || (e as { name?: string })?.name === 'AbortError') {
        return;
      }
      try {
        await Clipboard.setStringAsync(message);
        showSuccess('Convite copiado', 'Cole no WhatsApp, e-mail ou onde preferir');
      } catch {
        showError(e, 'Não foi possível compartilhar');
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Label>Convite</Label>
        <Text style={styles.adminHint}>Somente você compartilha</Text>
      </View>
      <View style={styles.row}>
        <Pressable
          onPress={copyCode}
          disabled={busy === 'code'}
          style={({ pressed }) => [styles.codeBox, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`Copiar código de convite ${code}`}
        >
          <Text style={styles.codeLabel}>Código da viagem</Text>
          <Text style={styles.code}>{code}</Text>
        </Pressable>
        <IconButton
          icon="copy-outline"
          label="Copiar código"
          onPress={copyCode}
          loading={busy === 'code'}
        />
        <Button
          title="Compartilhar"
          size="sm"
          icon="share-outline"
          onPress={shareInvite}
          loading={busy === 'share'}
          disabled={!!busy && busy !== 'share'}
        />
      </View>
      <Pressable
        onPress={copyLink}
        disabled={!!busy}
        style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Copiar link de convite"
      >
        <Ionicons name="link-outline" size={16} color={colors.inkSoft} />
        <Text style={styles.linkText} numberOfLines={1}>
          {inviteUrl}
        </Text>
        <Text style={styles.linkAction}>Copiar link</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  adminHint: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    color: colors.inkSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBox: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  codeLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    color: colors.inkSoft,
  },
  code: {
    fontSize: 22,
    fontFamily: fonts.uiHeavy,
    letterSpacing: 2.5,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  linkText: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
  },
  linkAction: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.accent,
  },
});
