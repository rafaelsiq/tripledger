import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Input, Screen, Title } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { normalizeInviteCode } from '@/src/lib/invite';
import { joinTripByCode } from '@/src/services/trips';
import { spacing } from '@/src/theme';

export default function JoinTripScreen() {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const paramCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState(normalizeInviteCode(paramCode));
  const [loading, setLoading] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    const next = normalizeInviteCode(paramCode);
    if (next) setCode(next);
  }, [paramCode]);

  async function onJoin(nextCode = code) {
    if (!user || !profile) {
      showError('Faça login para entrar na viagem.', 'Sessão necessária');
      return;
    }
    const normalized = normalizeInviteCode(nextCode);
    if (!normalized) {
      showError('Informe o código de convite.', 'Campo obrigatório');
      return;
    }
    try {
      setLoading(true);
      const tripId = await joinTripByCode(normalized, {
        uid: user.uid,
        displayName: profile.displayName,
        email: profile.email,
      });
      showSuccess('Você entrou na viagem');
      router.replace(`/(app)/trip/${tripId}`);
    } catch (e) {
      showError(e, 'Não foi possível entrar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoTried || !user || !profile) return;
    const normalized = normalizeInviteCode(paramCode);
    if (!normalized) return;
    setAutoTried(true);
    onJoin(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once when arriving with a code
  }, [autoTried, user, profile, paramCode]);

  return (
    <Screen>
      <View style={styles.form}>
        <Title>Entrar na viagem</Title>
        <Body muted>
          Cole o código recebido do administrador ou abra o link de convite compartilhado.
        </Body>
        <Input
          label="Código"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={(text) => setCode(normalizeInviteCode(text))}
          placeholder="ABC123"
        />
        <Button title="Entrar" onPress={() => onJoin()} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.lg },
});
