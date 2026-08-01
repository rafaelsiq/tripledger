export const fonts = {
  ui: 'Manrope_500Medium',
  uiSemi: 'Manrope_600SemiBold',
  uiBold: 'Manrope_700Bold',
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
};

export const colors = {
  bg: '#F4F6F8',
  bgSoft: '#EEF2F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F3F6',
  ink: '#14212B',
  inkSoft: '#5A6B7A',
  inkMuted: '#8A97A3',
  border: '#E6EAF0',
  accent: '#0C6B58',
  accentSoft: '#E3F2EE',
  accentDark: '#084C3F',
  finance: '#243B53',
  financeSoft: '#EAF0F5',
  warn: '#A15C07',
  warnSoft: '#FFF4DE',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  success: '#067647',
  successSoft: '#DCFAE6',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(20, 33, 43, 0.4)',
  shadow: 'rgba(20, 33, 43, 0.08)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const shadows = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export const typography = {
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    fontWeight: '700' as const,
    letterSpacing: -1,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.ink,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.inkSoft,
  },
  number: {
    fontFamily: fonts.uiBold,
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
    color: colors.finance,
  },
  label: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: colors.inkMuted,
  },
};

export function formatCurrency(value: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value || 0);
}
