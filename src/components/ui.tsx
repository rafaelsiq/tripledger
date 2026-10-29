import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, fonts, radii, spacing, typography } from '@/src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  style,
  narrow = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Deprecated: the ambient gradient was removed in the v2 visual system. */
  ambient?: boolean;
  /** Cap to form width (auth / short forms). Default uses full website content width. */
  narrow?: boolean;
}) {
  const { contentMaxWidth, formMaxWidth, pagePadding } = useLayout();
  const maxWidth = narrow ? formMaxWidth : contentMaxWidth;

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.screenContent,
          { maxWidth, paddingHorizontal: pagePadding, paddingVertical: pagePadding },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Page title block: optional eyebrow/status, title, subtitle and right-aligned actions. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderText}>
        {eyebrow}
        <Text style={typography.title}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.pageHeaderActions}>{actions}</View> : null}
    </View>
  );
}

/** Uppercase group label with an optional trailing value or link. */
export function SectionHeader({
  title,
  trailing,
  onTrailingPress,
}: {
  title: string;
  trailing?: string;
  onTrailingPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={typography.label}>{title}</Text>
      {trailing ? (
        onTrailingPress ? (
          <Pressable onPress={onTrailingPress} hitSlop={8}>
            <Text style={styles.sectionLink}>{trailing}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionValue}>{trailing}</Text>
        )
      ) : null}
    </View>
  );
}

/** One bordered surface holding related rows separated by dividers. */
export function ListGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.listGroup, style]}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? styles.listDivider : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  value,
  valueCaption,
  valueTone = 'neutral',
  onPress,
  chevron,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  value?: string;
  valueCaption?: string;
  valueTone?: Tone;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const content = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value || valueCaption ? (
        <View style={styles.rowValueBlock}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {valueCaption ? (
            <Text style={[styles.rowValueCaption, { color: toneMap[valueTone].fg }]}>
              {valueCaption}
            </Text>
          ) : null}
        </View>
      ) : null}
      {trailing ? <View>{trailing}</View> : null}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]}
    >
      {content}
    </Pressable>
  );
}

/** Rounded-square icon tile used as a list row's leading element. */
export function IconTile({ name, tone = 'neutral' }: { name: IconName; tone?: Tone }) {
  const map = toneMap[tone];
  return (
    <View style={[styles.iconTile, { backgroundColor: map.bg }]}>
      <Ionicons name={name} size={18} color={map.fg} />
    </View>
  );
}

export function Avatar({ name, size = 36, dashed }: { name: string; size?: number; dashed?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const palette = AVATAR_TONES[hash(name) % AVATAR_TONES.length];
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        dashed
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.iconMuted }
          : { backgroundColor: palette.bg },
      ]}
    >
      <Text style={[styles.avatarText, { color: dashed ? colors.inkSoft : palette.fg, fontSize: size * 0.36 }]}>
        {initials || '?'}
      </Text>
    </View>
  );
}

/** TripLedger logo: monogram tile + serif wordmark. */
export function BrandMark({ size = 'md', inverse }: { size?: 'md' | 'lg'; inverse?: boolean }) {
  const tile = size === 'lg' ? 44 : 32;
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="TripLedger">
      <View
        style={[
          styles.brandTile,
          { width: tile, height: tile, borderRadius: tile * 0.26 },
          inverse && { backgroundColor: colors.white },
        ]}
      >
        <Text
          style={[
            styles.brandTileText,
            { fontSize: tile * 0.56 },
            inverse && { color: colors.accent },
          ]}
        >
          T
        </Text>
      </View>
      <Text
        style={[
          styles.brandWord,
          { fontSize: size === 'lg' ? 34 : 22 },
          inverse && { color: colors.white },
        ]}
      >
        TripLedger
      </Text>
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={typography.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={typography.subtitle}>{children}</Text>;
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <Text style={[typography.body, muted && { color: colors.inkSoft }]}>{children}</Text>
  );
}

export function Caption({ children }: { children: React.ReactNode }) {
  return <Text style={typography.caption}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={typography.label}>{children}</Text>;
}

export function Money({ value, currency = 'BRL' }: { value: number; currency?: string }) {
  return (
    <Text style={typography.number}>
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0)}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'finance';
  size?: 'sm' | 'md';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const fg =
    variant === 'secondary'
      ? colors.ink
      : variant === 'ghost'
        ? colors.accent
        : variant === 'danger'
          ? colors.danger
          : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'finance' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.buttonText, size === 'sm' && { fontSize: 14 }, { color: fg }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Square icon-only button for toolbars (requires an accessibility label). */
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  loading,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { backgroundColor: colors.bg },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.inkLabel} />
      ) : (
        <Ionicons name={icon} size={18} color={colors.inkLabel} />
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, onFocus, onBlur, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, focused && styles.inputFocused, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

/** Segmented control for 2–4 mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'accent' | 'info';

const toneMap: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.inkSoft, border: colors.border },
  success: { bg: colors.successSoft, fg: colors.success, border: colors.successBorder },
  warn: { bg: colors.warnSoft, fg: colors.warn, border: colors.warnBorder },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerBorder },
  accent: { bg: colors.accentSoft, fg: colors.accentDark, border: colors.accentBorder },
  info: { bg: colors.infoSoft, fg: colors.info, border: colors.infoBorder },
};

const AVATAR_TONES = [toneMap.accent, toneMap.info, toneMap.warn, toneMap.neutral];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Badge({
  text,
  tone = 'neutral',
  dot,
}: {
  text: string;
  tone?: Tone;
  /** Leading status dot (used for trip phase pills). */
  dot?: boolean;
}) {
  const map = toneMap[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: map.fg }]} /> : null}
      <Text style={[styles.badgeText, { color: map.fg }]}>{text}</Text>
    </View>
  );
}

/** One-line contextual notice with an optional inline action. */
export function Notice({
  tone = 'info',
  icon,
  title,
  message,
  actionLabel,
  onAction,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  const map = toneMap[tone];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg, borderColor: map.border }]}>
      <View style={styles.noticeRow}>
        {icon ? <Ionicons name={icon} size={18} color={map.fg} style={{ marginTop: 1 }} /> : null}
        <Text style={[styles.noticeText, { color: colors.ink }]}>
          {title ? <Text style={styles.noticeTitle}>{title} </Text> : null}
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={[styles.noticeAction, { color: map.fg }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={typography.subtitle}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, { textAlign: 'center' }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContent: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pageHeaderText: { gap: 4, flexShrink: 1, minWidth: 180 },
  pageSubtitle: { ...typography.caption, fontSize: 14 },
  pageHeaderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLink: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.accent },
  sectionValue: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  listGroup: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  rowSubtitle: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkSoft },
  rowValueBlock: { alignItems: 'flex-end', gap: 2 },
  rowValue: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rowValueCaption: { fontFamily: fonts.uiBold, fontSize: 12 },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTile: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTileText: { fontFamily: fonts.brand, color: colors.white },
  brandWord: { fontFamily: fonts.brand, color: colors.ink, letterSpacing: -0.5 },
  avatarText: { fontFamily: fonts.uiHeavy },
  button: {
    minHeight: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonSm: { minHeight: 40, paddingHorizontal: 14 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: fonts.uiBold,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkLabel },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.ui,
  },
  inputFocused: { borderColor: colors.accent, borderWidth: 2, paddingHorizontal: 13 },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 9,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.inkSoft },
  segmentTextActive: { fontFamily: fonts.uiBold, color: colors.ink },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontFamily: fonts.uiBold },
  notice: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: spacing.sm,
  },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  noticeText: { flex: 1, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  noticeTitle: { fontFamily: fonts.uiBold },
  noticeAction: { fontFamily: fonts.uiBold, fontSize: 13 },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
