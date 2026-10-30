import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ActivityCategory } from '@/src/types';
import { colors, fonts, radii } from '@/src/theme';

const TINTS: Record<ActivityCategory, { bg: string; fg: string }> = {
  praia: { bg: colors.infoSoft, fg: colors.info },
  trilha: { bg: colors.accentSoft, fg: colors.accent },
  mirante: { bg: colors.warnSoft, fg: colors.warn },
  parque: { bg: colors.successSoft, fg: colors.success },
  passeio: { bg: colors.infoSoft, fg: colors.info },
  museu: { bg: colors.surfaceMuted, fg: colors.inkLabel },
  historico: { bg: colors.financeSoft, fg: colors.inkSoft },
  bar: { bg: colors.warnSoft, fg: colors.warn },
  gastronomia: { bg: colors.dangerSoft, fg: colors.danger },
  musica: { bg: colors.dangerSoft, fg: colors.danger },
  feira: { bg: colors.warnSoft, fg: colors.warn },
  esporte: { bg: colors.accentSoft, fg: colors.accentDark },
};

/** Photo of a rolê, or its first letter on the category's tint. */
export function CatalogRoleTile({
  title,
  category,
  imageUrl,
  size = 56,
  style,
}: {
  title: string;
  category: ActivityCategory;
  imageUrl?: string;
  size?: number;
  style?: object;
}) {
  // A custom `style` owns the box (e.g. a 16:9 hero); `size` then only scales the letter.
  // (Width/height can't be reset with `undefined` on web, so they're never set twice.)
  const box = style ?? { width: size, height: size };
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[styles.tile, box]} />;
  }
  const tint = TINTS[category] ?? TINTS.passeio;
  return (
    <View style={[styles.tile, { backgroundColor: tint.bg }, box]}>
      <Text style={[styles.letter, { color: tint.fg, fontSize: Math.round(size * 0.4) }]}>
        {title.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  letter: { fontFamily: fonts.uiHeavy },
});
