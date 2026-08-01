import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, Input, Screen, Title } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { joinTripByCode } from '@/src/services/trips';
import { spacing } from '@/src/theme';

export default function JoinTripScreen() {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function onJoin() {
    if (!user || !profile) {
      showError('Faça login para entrar na viagem.', 'Sessão necessária');
      return;
    }
    if (!code.trim()) {
      showError('Informe o código de convite.', 'Campo obrigatório');
      return;
    }
    try {
      setLoading(true);
      const tripId = await joinTripByCode(code, {
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

  return (
    <Screen>
      <View style={styles.form}>
        <Title>Entrar na viagem</Title>
        <Body muted>Peça o código de convite ao administrador do grupo.</Body>
        <Input
          label="Código"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          placeholder="ABC123"
        />
        <Button title="Entrar" onPress={onJoin} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.lg },
});
