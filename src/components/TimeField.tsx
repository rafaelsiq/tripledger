import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Label } from '@/src/components/ui';
import type { TimeFieldProps } from '@/src/components/TimeField.types';
import { formatMinutesAsTime, parseItemTime } from '@/src/lib/itineraryStory';
import { colors, fonts, radii, spacing } from '@/src/theme';

export type { TimeFieldProps };

function toDate(value: string): Date {
  const minutes = parseItemTime(value) ?? 9 * 60;
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function fromDate(date: Date): string {
  return formatMinutesAsTime(date.getHours() * 60 + date.getMinutes());
}

/** Tap-to-pick `HH:mm` field backed by the native time picker. */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Horário não definido',
}: TimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => new Date());

  function openPicker() {
    const initial = toDate(value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'time',
        is24Hour: true,
        positiveButton: { label: 'OK', textColor: colors.accent },
        negativeButton: { label: 'Cancelar', textColor: colors.inkSoft },
        onValueChange: (_event, date) => {
          onChange(fromDate(date));
        },
        onDismiss: () => undefined,
      });
      return;
    }
    setIosDraft(initial);
    setIosOpen(true);
  }

  function confirmIos() {
    onChange(fromDate(iosDraft));
    setIosOpen(false);
  }

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

      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Ionicons name="time-outline" size={20} color={value ? colors.accent : colors.inkMuted} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </Pressable>

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
              mode="time"
              display="spinner"
              locale="pt-BR"
              is24Hour
              themeVariant="light"
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
  clear: { color: colors.accent, fontFamily: fonts.uiSemi, fontSize: 12 },
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
  fieldPressed: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  value: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.ui,
    fontVariant: ['tabular-nums'],
  },
  placeholder: { color: colors.inkMuted },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
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
  sheetTitle: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  sheetAction: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.inkSoft, minWidth: 72 },
  sheetConfirm: { color: colors.accent, textAlign: 'right' },
  iosPicker: { alignSelf: 'stretch' },
});
