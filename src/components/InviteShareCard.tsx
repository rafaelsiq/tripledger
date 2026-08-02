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
    try {
      setBusy('share');
      await Share.share({
        message: buildInviteShareMessage(tripName, code),
        url: inviteUrl,
        title: `Convite — ${tripName}`,
      });
    } catch (e) {
      // User dismissing the sheet is not an error on some platforms.
      const message = e instanceof Error ? e.message : '';
      if (!/cancel|dismiss/i.test(message)) {
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
        {isAdmin ? <Text style={styles.adminHint}>Somente você compartilha</Text> : null}
      </View>

      <Body muted>
        {isAdmin
          ? 'Compartilhe o código ou o link para novos membros entrarem na viagem.'
          : 'Peça o código ou o link de convite ao administrador do grupo.'}
      </Body>

      <Pressable
        onPress={isAdmin ? copyCode : undefined}
        disabled={!isAdmin || busy === 'code'}
        style={({ pressed }) => [
          styles.codeBox,
          isAdmin && pressed && styles.codeBoxPressed,
          !isAdmin && styles.codeBoxReadonly,
        ]}
        accessibilityRole={isAdmin ? 'button' : 'text'}
        accessibilityLabel={`Código de convite ${code}`}
      >
        <Text style={styles.code}>{code}</Text>
        {isAdmin ? (
          <View style={styles.copyHint}>
            <Ionicons name="copy-outline" size={18} color={colors.accent} />
            <Text style={styles.copyHintText}>Copiar código</Text>
          </View>
        ) : null}
      </Pressable>

      {isAdmin ? (
        <>
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
        </>
      ) : null}
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
  codeBoxReadonly: {
    opacity: 0.92,
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
