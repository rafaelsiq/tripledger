import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Body, Button, Input, Screen, Title } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { loginWithEmail } from '@/src/services/auth';
import { colors, spacing, typography } from '@/src/theme';

export default function LoginScreen() {
  const { showError } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email.trim() || !password) {
      showError('Informe e-mail e senha.', 'Campos obrigatórios');
      return;
    }
    try {
      setLoading(true);
      await loginWithEmail(email, password);
    } catch (e) {
      showError(e, 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>TripLedger</Text>
          <Body muted>Planeje, execute e feche a viagem — juntos e em dia.</Body>
        </View>
        <View style={styles.form}>
          <Title>Entrar</Title>
          <Input
            label="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
          />
          <Input
            label="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Button title="Entrar" onPress={onLogin} loading={loading} />
          <Link href="/(auth)/register" style={styles.link}>
            Criar conta
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  inner: { gap: spacing.xl },
  brand: { gap: spacing.sm },
  logo: {
    ...typography.brand,
    color: colors.accentDark,
  },
  form: { gap: spacing.md },
  link: {
    textAlign: 'center',
    color: colors.accent,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
