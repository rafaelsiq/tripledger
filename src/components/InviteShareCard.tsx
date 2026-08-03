import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Label } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import {
  buildInviteShareMessage,
  buildInviteShareUrl,
  normalizeInviteCode,
} from '@/src/lib/invite';
import { colors, fonts, radii, spacing } from '@/src/theme';

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

      <Body muted>
        Compartilhe o código ou o link para novos membros entrarem na viagem.
      </Body>

      <Pressable
        onPress={copyCode}
        disabled={busy === 'code'}
        style={({ pressed }) => [styles.codeBox, pressed && styles.codeBoxPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Código de convite ${code}`}
      >
        <Text style={styles.code}>{code}</Text>
        <View style={styles.copyHint}>
          <Ionicons name="copy-outline" size={18} color={colors.accent} />
          <Text style={styles.copyHintText}>Copiar código</Text>
        </View>
      </Pressable>

      <View style={styles.linkRow}>
        <Ionicons name="link-outline" size={16} color={colors.inkMuted} />
        <Text style={styles.linkText} numberOfLines={2}>
          {inviteUrl}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Copiar link"
          variant="secondary"
          onPress={copyLink}
          loading={busy === 'link'}
          disabled={!!busy && busy !== 'link'}
        />
        <Button
          title="Compartilhar"
          onPress={shareInvite}
          loading={busy === 'share'}
          disabled={!!busy && busy !== 'share'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  adminHint: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  codeBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#C6E3DB',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBoxPressed: {
    backgroundColor: '#D7EDE7',
  },
  code: {
    fontSize: 32,
    fontFamily: fonts.uiBold,
    letterSpacing: 6,
    color: colors.accentDark,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyHintText: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accent,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  linkText: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
  },
});
