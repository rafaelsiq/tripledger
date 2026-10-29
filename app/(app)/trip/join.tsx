import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Input, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { normalizeInviteCode } from '@/src/lib/invite';
import { getResolvedUserProfile } from '@/src/services/auth';
import { joinTripByCode } from '@/src/services/trips';
import { fonts, spacing } from '@/src/theme';

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
      const resolved = await getResolvedUserProfile(user);
      const tripId = await joinTripByCode(normalized, resolved);
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
    <Screen narrow>
      <View style={styles.form}>
        <PageHeader
          title="Entrar com código"
          subtitle="Cole o código recebido do administrador ou abra o link de convite."
        />
        <Card style={styles.card}>
          <Input
            label="Código de convite"
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={(text) => setCode(normalizeInviteCode(text))}
            placeholder="ABC123"
            onSubmitEditing={() => onJoin()}
            style={styles.codeInput}
          />
          <Button title="Entrar na viagem" onPress={() => onJoin()} loading={loading} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingTop: spacing.xs },
  card: { gap: spacing.md },
  codeInput: { fontFamily: fonts.uiHeavy, fontSize: 22, letterSpacing: 4, textAlign: 'center' },
});
