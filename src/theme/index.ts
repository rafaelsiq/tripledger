export const colors = {
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEEEA',
  ink: '#1A1F24',
  inkSoft: '#5C6570',
  inkMuted: '#8B939C',
  border: '#E2E0DA',
  accent: '#0F6E56',
  accentSoft: '#E4F3EE',
  accentDark: '#0A4F3D',
  finance: '#1B3A4B',
  financeSoft: '#E8EEF2',
  warn: '#B45309',
  warnSoft: '#FEF3C7',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  success: '#067647',
  successSoft: '#DCFAE6',
  itinerary: '#1C1917',
  itineraryAccent: '#C2410C',
  feed: '#0C0A09',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(26, 31, 36, 0.45)',
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const typography = {
  brand: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.ink,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.inkSoft,
  },
  number: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
    color: colors.finance,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
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
