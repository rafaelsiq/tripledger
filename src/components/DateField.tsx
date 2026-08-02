import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Label } from '@/src/components/ui';
import type { DateFieldProps } from '@/src/components/DateField.types';
import {
  clampDate,
  formatDateLabel,
  parseDateValue,
  toDateValue,
} from '@/src/lib/dates';
import { colors, fonts, radii, spacing } from '@/src/theme';

export type { DateFieldProps };

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Selecionar data',
  minimumDate,
  maximumDate,
  optional = false,
  helperText,
}: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => new Date());

  const minDate = useMemo(() => parseDateValue(minimumDate) ?? undefined, [minimumDate]);
  const maxDate = useMemo(() => parseDateValue(maximumDate) ?? undefined, [maximumDate]);
  const selected = useMemo(() => parseDateValue(value), [value]);

  function openPicker() {
    const base = selected ?? minDate ?? new Date();
    const initial = clampDate(base, minDate, maxDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        display: 'calendar',
        minimumDate: minDate,
        maximumDate: maxDate,
        positiveButton: { label: 'OK', textColor: colors.accent },
        negativeButton: { label: 'Cancelar', textColor: colors.inkSoft },
        onValueChange: (_event, date) => {
          onChange(toDateValue(date));
        },
        onDismiss: () => undefined,
      });
      return;
    }

    setIosDraft(initial);
    setIosOpen(true);
  }

  function confirmIos() {
    onChange(toDateValue(clampDate(iosDraft, minDate, maxDate)));
    setIosOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Label>{label}</Label>
        {optional && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8}>
            <Text style={styles.clear}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDateLabel(value, placeholder)}`}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={value ? colors.accent : colors.inkMuted}
        />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {formatDateLabel(value, placeholder)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.inkMuted} />
      </Pressable>

      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      {Platform.OS === 'ios' && iosOpen ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setIosOpen(false)} hitSlop={8}>
                <Text style={styles.sheetAction}>Cancelar</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={confirmIos} hitSlop={8}>
                <Text style={[styles.sheetAction, styles.sheetConfirm]}>OK</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosDraft}
              mode="date"
              display="spinner"
              locale="pt-BR"
              themeVariant="light"
              minimumDate={minDate}
              maximumDate={maxDate}
              onValueChange={(_event, date) => setIosDraft(date)}
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
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
  clear: {
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    fontSize: 12,
  },
  field: {
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
  fieldPressed: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  value: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.ui,
  },
  placeholder: {
    color: colors.inkMuted,
  },
  helper: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    marginTop: 'auto',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.ink,
  },
  sheetAction: {
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.inkSoft,
    minWidth: 72,
  },
  sheetConfirm: {
    color: colors.accent,
    textAlign: 'right',
  },
  iosPicker: {
    alignSelf: 'stretch',
  },
});
