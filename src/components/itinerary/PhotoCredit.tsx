import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/src/theme';

/** "Foto: Author · License · Wikimedia Commons", linking to the file page (license requirement). */
export function PhotoCredit({ credit, sourceUrl }: { credit: string; sourceUrl?: string }) {
  const label = `Foto: ${credit} · Wikimedia Commons`;
  if (!sourceUrl) return <Text style={styles.text}>{label}</Text>;
  return (
    <Pressable
      onPress={() => Linking.openURL(sourceUrl)}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Text style={[styles.text, styles.link]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.ui, fontSize: 11, lineHeight: 15, color: colors.inkMuted, marginTop: -8 },
  link: { textDecorationLine: 'underline' },
});
