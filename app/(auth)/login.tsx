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
import { colors, fonts, spacing } from '@/src/theme';

export default function LoginScreen() {
  const { showError } = useToast();
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

  return (
    <Screen ambient style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Animated.View style={[styles.brand, { opacity: fade, transform: [{ translateY: slide }] }]}>
          <Text style={styles.logo}>TripLedger</Text>
          <Body muted>Planeje, execute e feche a viagem — juntos e em dia.</Body>
        </Animated.View>
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
  inner: { gap: spacing.xl, flex: 1, justifyContent: 'center' },
  brand: { gap: spacing.sm },
  logo: {
    fontFamily: fonts.displayBold,
    fontSize: 44,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  form: { gap: spacing.md },
  link: {
    textAlign: 'center',
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    marginTop: spacing.sm,
  },
});
