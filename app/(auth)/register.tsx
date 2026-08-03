import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Body, Button, Input, Screen, Title } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { registerWithEmail } from '@/src/services/auth';
import { colors, fonts, layout, spacing } from '@/src/theme';

function useSiteLayout() {
  const [site, setSite] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setSite(false);
      return;
    }
    const mq = window.matchMedia(`(min-width: ${layout.breakpointMd}px)`);
    const apply = () => setSite(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  return site;
}

export default function RegisterScreen() {
  const { showError, showSuccess } = useToast();
  const site = useSiteLayout();
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

  const form = (
    <View style={styles.form}>
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
    </View>
  );

  if (site) {
    return (
      <View style={styles.split}>
        <View style={styles.splitBrand}>
          <Text style={styles.logoWide}>TripLedger</Text>
          <Body muted>Uma conta para planejar, gastar e fechar a viagem com o grupo.</Body>
        </View>
        <View style={styles.splitForm}>
          <View style={styles.splitFormInner}>{form}</View>
        </View>
      </View>
    );
  }

  return (
    <Screen ambient style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        {form}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  wrap: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
  },
  splitBrand: {
    flex: 1.15,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: 56,
    paddingVertical: spacing.xl,
    backgroundColor: colors.accentSoft,
  },
  splitForm: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
  },
  splitFormInner: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoWide: {
    fontFamily: fonts.displayBold,
    fontSize: 56,
    letterSpacing: -1.6,
    color: colors.ink,
  },
  form: { gap: spacing.md, width: '100%' },
  link: {
    textAlign: 'center',
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    marginTop: spacing.sm,
  },
});
