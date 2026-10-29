import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BrandMark, Button, Input, Screen, Title } from '@/src/components/ui';
import { useToast } from '@/src/hooks/useToast';
import { loginWithEmail } from '@/src/services/auth';
import { colors, fonts, layout, spacing } from '@/src/theme';

/** Desktop website layout on web by default; stacks on narrow viewports / native. */
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

export default function LoginScreen() {
  const { showError } = useToast();
  const site = useSiteLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

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

  const brandPanel = (
    <Animated.View style={[styles.brandPanel, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <BrandMark size="lg" inverse />
      <Text style={styles.brandHeadline}>Planeje, divida e feche a viagem com o grupo.</Text>
      <View style={styles.brandPoints}>
        <AuthPoint text="Despesas divididas e acerto de contas automático" />
        <AuthPoint text="Roteiro do dia com votação do grupo" />
        <AuthPoint text="Memórias da viagem num só lugar" />
      </View>
    </Animated.View>
  );

  const form = (
    <View style={styles.form}>
      <View style={styles.heading}>
        <Title>Entrar</Title>
        <Text style={styles.subtitle}>Use o e-mail da sua conta TripLedger.</Text>
      </View>
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
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        placeholder="Sua senha"
        onSubmitEditing={onLogin}
      />
      <Button title="Entrar" onPress={onLogin} loading={loading} />
      <Text style={styles.footer}>
        Ainda não tem conta?{' '}
        <Link href="/(auth)/register" style={styles.link}>
          Criar conta
        </Link>
      </Text>
    </View>
  );

  if (site) {
    return (
      <View style={styles.split} testID="login-site-split">
        <View style={styles.splitBrand}>{brandPanel}</View>
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
        style={styles.inner}
      >
        <BrandMark />
        {form}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AuthPoint({ text }: { text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name="checkmark-circle" size={18} color={colors.accentBorder} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface },
  inner: {
    gap: 40,
    flex: 1,
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
  brandPoints: { gap: 12 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.accentSoft },
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
