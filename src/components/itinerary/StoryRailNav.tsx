import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, fonts, spacing } from '@/src/theme';

type Props = {
  children: React.ReactNode;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevAccessibilityLabel: string;
  nextAccessibilityLabel: string;
  positionHint: string;
  railRef?: React.RefObject<ScrollView | null>;
  snapToInterval?: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  railStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Shared horizontal rail chrome for storytelling — side arrows on desktop, under-rail on mobile. */
export function StoryRailNav({
  children,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  prevAccessibilityLabel,
  nextAccessibilityLabel,
  positionHint,
  railRef,
  snapToInterval,
  onScroll,
  railStyle,
  contentContainerStyle,
}: Props) {
  const { isWide } = useLayout();

  const prevBtn = (
    <Pressable
      onPress={onPrev}
      disabled={!canGoPrev}
      accessibilityRole="button"
      accessibilityLabel={prevAccessibilityLabel}
      style={({ pressed }) => [
        styles.sideBtn,
        !isWide && styles.sideBtnCompact,
        !canGoPrev && styles.sideBtnDisabled,
        pressed && canGoPrev && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name="chevron-back"
        size={isWide ? 22 : 20}
        color={canGoPrev ? colors.accent : colors.inkMuted}
      />
    </Pressable>
  );

  const nextBtn = (
    <Pressable
      onPress={onNext}
      disabled={!canGoNext}
      accessibilityRole="button"
      accessibilityLabel={nextAccessibilityLabel}
      style={({ pressed }) => [
        styles.sideBtn,
        !isWide && styles.sideBtnCompact,
        !canGoNext && styles.sideBtnDisabled,
        pressed && canGoNext && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name="chevron-forward"
        size={isWide ? 22 : 20}
        color={canGoNext ? colors.accent : colors.inkMuted}
      />
    </Pressable>
  );

  const rail = (
    <ScrollView
      ref={railRef}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snapToInterval}
      snapToAlignment="start"
      disableIntervalMomentum
      style={[styles.rail, railStyle]}
      contentContainerStyle={[styles.railContent, contentContainerStyle]}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {children}
    </ScrollView>
  );

  if (!isWide) {
    return (
      <View style={styles.railWrap}>
        {rail}
        <View style={styles.mobileControls}>
          {prevBtn}
          <Text style={styles.positionHint} numberOfLines={1}>
            {positionHint}
          </Text>
          {nextBtn}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.railWrap}>
      <View style={styles.railRow}>
        {prevBtn}
        {rail}
        {nextBtn}
      </View>
      <Text style={styles.positionHint}>{positionHint}</Text>
    </View>
  );
}

export const storyHeroStyles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  eyebrow: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.6,
  },
  titleCompact: {
    fontSize: 26,
    letterSpacing: -0.4,
  },
  date: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    textTransform: 'capitalize',
  },
  bannerSlot: {
    marginBottom: spacing.md,
  },
});

const styles = StyleSheet.create({
  railWrap: {
    gap: spacing.sm,
    width: '100%',
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  mobileControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#C6E3DB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sideBtnCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sideBtnDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  rail: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'hidden',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as object)
      : null),
  },
  railContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.sm,
  },
  positionHint: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.inkSoft,
  },
});
