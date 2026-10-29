import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Label } from '@/src/components/ui';
import type { TimeFieldProps } from '@/src/components/TimeField.types';
import { colors, fonts, radii, spacing } from '@/src/theme';

export type { TimeFieldProps };

/**
 * Web variant: the visible field is ours; a transparent `<input type="time">` laid on
 * top receives the click and opens the browser's own time picker.
 */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Horário não definido',
}: TimeFieldProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Label>{label}</Label>
        {value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8}>
            <Text style={styles.clear}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.field}>
        <Ionicons name="time-outline" size={20} color={value ? colors.accent : colors.inkMuted} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <input
          type="time"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // Some browsers refuse showPicker outside a trusted gesture; focus still works.
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            border: 'none',
            padding: 0,
            margin: 0,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  clear: { color: colors.accent, fontFamily: fonts.uiSemi, fontSize: 12 },
  field: {
    position: 'relative',
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.ui,
    fontVariant: ['tabular-nums'],
  },
  placeholder: { color: colors.inkMuted },
});
