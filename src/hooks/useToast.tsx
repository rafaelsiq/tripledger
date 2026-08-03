import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '@/src/lib/errors';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, fonts, radii, spacing } from '@/src/theme';

type ToastTone = 'error' | 'success' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showError: (error: unknown, title?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showMessage: (title: string, message?: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const opacity = useRef(new Animated.Value(0)).current;
  const { toastMaxWidth } = useLayout();

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (title: string, message?: string, tone: ToastTone = 'info') => {
      const id = idRef.current++;
      setToasts((prev) => [...prev.slice(-2), { id, title, message, tone }]);
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(4200),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) dismiss(id);
      });
    },
    [dismiss, opacity]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showError: (error, title = 'Erro') => {
        push(title, getErrorMessage(error), 'error');
      },
      showSuccess: (title, message) => push(title, message, 'success'),
      showInfo: (title, message) => push(title, message, 'info'),
      showMessage: (title, message, tone = 'info') => push(title, message, tone),
    }),
    [push]
  );

  const current = toasts[toasts.length - 1];

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current ? (
        <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="box-none">
          <Pressable
            onPress={() => dismiss(current.id)}
            style={[
              styles.toast,
              { maxWidth: toastMaxWidth },
              current.tone === 'error' && styles.error,
              current.tone === 'success' && styles.success,
              current.tone === 'info' && styles.info,
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{current.title}</Text>
              {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
            </View>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    width: '100%',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECACA',
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: '#A6F4C5',
  },
  info: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.ink,
  },
  message: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  close: {
    color: colors.inkMuted,
    fontSize: 14,
    paddingLeft: 4,
  },
});
