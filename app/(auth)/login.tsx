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
import { Body, Button, Input, Screen, Title } from '@/src/components/ui';
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

  const brand = (
    <Animated.View style={[styles.brand, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <Text style={[styles.logo, site && styles.logoWide]}>TripLedger</Text>
      <Body muted>Planeje, execute e feche a viagem — juntos e em dia.</Body>
    </Animated.View>
  );

  const form = (
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
  );

  if (site) {
    return (
      <View style={styles.split} testID="login-site-split">
        <View style={styles.splitBrand}>{brand}</View>
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
        style={styles.inner}
      >
        {brand}
        {form}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  inner: {
    gap: spacing.xl,
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
  brand: { gap: spacing.sm, maxWidth: 520 },
  logo: {
    fontFamily: fonts.displayBold,
    fontSize: 44,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  logoWide: {
    fontSize: 64,
    letterSpacing: -2,
  },
  form: { gap: spacing.md, width: '100%' },
  link: {
    textAlign: 'center',
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    marginTop: spacing.sm,
  },
});
