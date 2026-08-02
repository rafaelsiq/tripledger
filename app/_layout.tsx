import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  Stack,
  useGlobalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/src/hooks/useAuth';
import { ToastProvider } from '@/src/hooks/useToast';
import {
  consumePendingInviteCode,
  normalizeInviteCode,
  stashPendingInviteCode,
} from '@/src/lib/invite';
import { colors } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ code?: string | string[] }>();

  React.useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
    const inviteCode = normalizeInviteCode(rawCode);
    const onJoinRoute = pathname.includes('/trip/join');

    if (!user && !inAuth) {
      if (onJoinRoute && inviteCode) {
        stashPendingInviteCode(inviteCode).catch(() => undefined);
      }
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuth) {
      let cancelled = false;
      (async () => {
        const pending = await consumePendingInviteCode();
        if (cancelled) return;
        if (pending) {
          router.replace({
            pathname: '/(app)/trip/join',
            params: { code: pending },
          });
          return;
        }
        router.replace('/(app)');
      })().catch(() => {
        if (!cancelled) router.replace('/(app)');
      });
      return () => {
        cancelled = true;
      };
    }
  }, [user, loading, segments, router, pathname, params.code]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    ...Ionicons.font,
  });
  const [fontsTimedOut, setFontsTimedOut] = React.useState(false);

  React.useEffect(() => {
    // Keep UI usable if a remote font stalls, but prefer waiting for icon fonts.
    const timer = setTimeout(() => setFontsTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || !!fontError || fontsTimedOut;

  React.useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <StatusBar style="dark" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </AuthGate>
      </ToastProvider>
    </AuthProvider>
  );
}
