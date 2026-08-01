import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Body, Button, Input, Screen, Title } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { registerWithEmail } from '@/src/services/auth';
import { colors, fonts, spacing } from '@/src/theme';

export default function RegisterScreen() {
  const { showError, showSuccess } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    if (!displayName.trim() || !email.trim() || !password) {
      showError('Preencha nome, e-mail e senha.', 'Campos obrigatórios');
      return;
    }
    try {
      setLoading(true);
      await registerWithEmail(email, password, displayName);
      showSuccess('Conta criada', 'Bem-vindo ao TripLedger.');
    } catch (e) {
      showError(e, 'Falha no cadastro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen ambient style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.form}
      >
        <Title>Criar conta</Title>
        <Body muted>Organize viagens em grupo com finanças e roteiro claros.</Body>
        <Input label="Nome" value={displayName} onChangeText={setDisplayName} placeholder="Seu nome" />
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
          placeholder="Mínimo 6 caracteres"
        />
        <Button title="Cadastrar" onPress={onRegister} loading={loading} />
        <Link href="/(auth)/login" style={styles.link}>
          Já tenho conta
        </Link>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  form: { gap: spacing.md, flex: 1, justifyContent: 'center' },
  link: {
    textAlign: 'center',
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    marginTop: spacing.sm,
  },
});
