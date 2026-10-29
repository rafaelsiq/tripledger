import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { BrandMark, Button, Input, Screen, Title } from '@/src/components/ui';
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
      <View style={styles.heading}>
        <Title>Criar conta</Title>
        <Text style={styles.subtitle}>Organize viagens em grupo com finanças e roteiro claros.</Text>
      </View>
      <Input
        label="Nome"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Seu nome"
        autoComplete="name"
      />
      <Input
        label="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
      />
      <Input
        label="Senha"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 6 caracteres"
        onSubmitEditing={onRegister}
      />
      <Button title="Criar conta" onPress={onRegister} loading={loading} />
      <Text style={styles.footer}>
        Já tem conta?{' '}
        <Link href="/(auth)/login" style={styles.link}>
          Entrar
        </Link>
      </Text>
    </View>
  );

  if (site) {
    return (
      <View style={styles.split}>
        <View style={styles.splitBrand}>
          <View style={styles.brandPanel}>
            <BrandMark size="lg" inverse />
            <Text style={styles.brandHeadline}>
              Uma conta para planejar, gastar e fechar a viagem com o grupo.
            </Text>
          </View>
        </View>
        <View style={styles.splitForm}>
          <View style={styles.splitFormInner}>{form}</View>
        </View>
      </View>
    );
  }

  return (
    <Screen style={styles.screen} narrow>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <BrandMark />
        {form}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface },
  wrap: {
    flex: 1,
    gap: 40,
    justifyContent: 'center',
    width: '100%',
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
  },
  splitBrand: {
    flex: 1.1,
    justifyContent: 'center',
    paddingHorizontal: 64,
    paddingVertical: spacing.xl,
    backgroundColor: colors.accent,
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
    maxWidth: 380,
    alignSelf: 'center',
  },
  brandPanel: { gap: spacing.lg, maxWidth: 480 },
  brandHeadline: {
    fontFamily: fonts.uiHeavy,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.6,
    color: colors.white,
  },
  form: { gap: spacing.md, width: '100%' },
  heading: { gap: 6, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkSoft },
  footer: {
    textAlign: 'center',
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  link: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
  },
});
