import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  fromLabel: string;
  toLabel: string;
  onPress?: () => void;
  compact?: boolean;
};

/** Visual bridge from the end of one day into the start of the next. */
export function StoryDayBridge({ fromLabel, toLabel, onPress, compact }: Props) {
  const content = (
    <>
      <View style={styles.line} />
      <View style={[styles.pill, compact && styles.pillCompact]}>
        <Ionicons name="moon-outline" size={compact ? 12 : 14} color={colors.accent} />
        <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={2}>
          {fromLabel} → {toLabel}
        </Text>
        <Ionicons name="sunny-outline" size={compact ? 12 : 14} color={colors.accent} />
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
        style={({ pressed }) => [styles.wrap, compact && styles.wrapCompact, pressed && { opacity: 0.88 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.wrap, compact && styles.wrapCompact]}>{content}</View>;
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
  wrapCompact: {
    width: 88,
    minHeight: 220,
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
  text: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    color: colors.accent,
    textAlign: 'center',
    lineHeight: 13,
  },
  textCompact: {
    fontSize: 10,
  },
});
