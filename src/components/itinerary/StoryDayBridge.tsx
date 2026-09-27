import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  fromLabel: string;
  toLabel: string;
  onPress?: () => void;
  compact?: boolean;
};

/** Visual bridge from the end of one day into the start of the next. */
export function StoryDayBridge({ fromLabel, toLabel, onPress, compact }: Props) {
  const { isWide } = useLayout();
  const wrapStyle = [
    styles.wrap,
    !isWide && styles.wrapNarrow,
    compact && styles.wrapCompact,
    compact && !isWide && styles.wrapCompactNarrow,
  ];

  const content = (
    <>
      <View style={styles.line} />
      <View style={[styles.pill, compact && styles.pillCompact, !isWide && styles.pillNarrow]}>
        <Ionicons name="moon-outline" size={compact || !isWide ? 12 : 14} color={colors.accent} />
        <Text
          style={[styles.text, (compact || !isWide) && styles.textCompact]}
          numberOfLines={2}
        >
          {fromLabel} → {toLabel}
        </Text>
        <Ionicons name="sunny-outline" size={compact || !isWide ? 12 : 14} color={colors.accent} />
      </View>
      <View style={styles.line} />
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Ir de ${fromLabel} para ${toLabel}`}
        style={({ pressed }) => [...wrapStyle, pressed && { opacity: 0.88 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={wrapStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    width: 72,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: 4,
  },
  wrapNarrow: {
    width: 52,
    paddingHorizontal: 2,
  },
  wrapCompact: {
    minHeight: 220,
  },
  wrapCompactNarrow: {
    minHeight: 200,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: colors.accent,
    opacity: 0.35,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#C6E3DB',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  pillCompact: {
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  pillNarrow: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  text: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    color: colors.accent,
    textAlign: 'center',
    lineHeight: 13,
  },
  textCompact: {
    fontSize: 9,
    lineHeight: 12,
  },
});
