export const fonts = {
  ui: 'Manrope_500Medium',
  uiSemi: 'Manrope_600SemiBold',
  uiBold: 'Manrope_700Bold',
  uiHeavy: 'Manrope_800ExtraBold',
  /** Page and section titles: Manrope only, serif is reserved for the wordmark. */
  display: 'Manrope_800ExtraBold',
  displayBold: 'Manrope_800ExtraBold',
  /** TripLedger wordmark only. */
  brand: 'Fraunces_600SemiBold',
};

export const colors = {
  bg: '#F5F6F8',
  bgSoft: '#F0F2F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2F5',
  surfaceSunken: '#E9ECF0',
  ink: '#101828',
  inkSoft: '#475467',
  /** Lightest text tone that still passes 4.5:1 on white. */
  inkMuted: '#667085',
  inkLabel: '#344054',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',
  divider: '#F0F2F5',
  iconMuted: '#98A2B3',
  accent: '#0B6E5C',
  accentSoft: '#E6F2EF',
  accentDark: '#08503F',
  accentBorder: '#B7DCD3',
  finance: '#101828',
  financeSoft: '#F5F6F8',
  info: '#2F4BB5',
  infoSoft: '#EEF4FF',
  infoBorder: '#C7D7FE',
  warn: '#A04A05',
  warnSoft: '#FFF6E5',
  warnBorder: '#FEDF89',
  warnStrong: '#F79009',
  danger: '#B42318',
  dangerSoft: '#FEF0EF',
  dangerBorder: '#FDA29B',
  success: '#067647',
  successSoft: '#ECFDF3',
  successBorder: '#ABEFC6',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(16, 24, 40, 0.45)',
  shadow: 'rgba(16, 24, 40, 0.08)',
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
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const layout = {
  /** Website content width (not a phone shell). */
  contentMaxWidth: 1280,
  /** Auth / dense forms stay readable. */
  formMaxWidth: 420,
  toastMaxWidth: 440,
  breakpointMd: 768,
  breakpointLg: 1100,
  pagePadding: 16,
  pagePaddingWide: 40,
};

export const shadows = {
  /** Cards are flat: border only. Kept as a spread target for existing styles. */
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** Floating surfaces only: sheets, menus, popovers, FAB. */
  raised: {
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

/** Shared navigator header look: white bar with a hairline divider. */
export const navHeader = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: true,
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.uiBold, fontSize: 16 },
  contentStyle: { backgroundColor: colors.bg },
};

export const typography = {
  brand: {
    fontFamily: fonts.brand,
    fontSize: 40,
    fontWeight: '600' as const,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  section: {
    fontFamily: fonts.uiBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 15,
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
    fontFamily: fonts.uiHeavy,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    color: colors.finance,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
    color: colors.inkSoft,
  },
};

export function formatCurrency(value: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value || 0);
}
