import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Label } from '@/src/components/ui';
import {
  clampDate,
  formatDateLabel,
  parseDateValue,
  toDateValue,
} from '@/src/lib/dates';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';
import type { DateFieldProps } from '@/src/components/DateField.types';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

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
  const [open, setOpen] = useState(false);
  const minDate = useMemo(() => parseDateValue(minimumDate) ?? undefined, [minimumDate]);
  const maxDate = useMemo(() => parseDateValue(maximumDate) ?? undefined, [maximumDate]);
  const selected = useMemo(() => parseDateValue(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (open) {
      setVisibleMonth(selected ?? minDate ?? new Date());
    }
  }, [open, selected, minDate]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  function isDisabled(day: Date) {
    const key = toDateValue(day);
    if (minimumDate && key < minimumDate) return true;
    if (maximumDate && key > maximumDate) return true;
    return false;
  }

  function pick(day: Date) {
    if (isDisabled(day)) return;
    onChange(toDateValue(clampDate(day, minDate, maxDate)));
    setOpen(false);
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
        onPress={() => setOpen(true)}
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

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Pressable
                onPress={() => setVisibleMonth((m) => subMonths(m, 1))}
                style={styles.navBtn}
                accessibilityLabel="Mês anterior"
              >
                <Ionicons name="chevron-back" size={20} color={colors.ink} />
              </Pressable>
              <Text style={styles.monthTitle}>
                {format(visibleMonth, 'MMMM yyyy', { locale: ptBR })}
              </Text>
              <Pressable
                onPress={() => setVisibleMonth((m) => addMonths(m, 1))}
                style={styles.navBtn}
                accessibilityLabel="Próximo mês"
              >
                <Ionicons name="chevron-forward" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekday}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {days.map((day) => {
                const inMonth = isSameMonth(day, visibleMonth);
                const selectedDay = selected ? isSameDay(day, selected) : false;
                const today = isToday(day);
                const disabled = isDisabled(day);
                return (
                  <Pressable
                    key={day.toISOString()}
                    disabled={disabled}
                    onPress={() => pick(day)}
                    style={[
                      styles.dayCell,
                      selectedDay && styles.daySelected,
                      today && !selectedDay && styles.dayToday,
                      disabled && styles.dayDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && styles.dayOutside,
                        selectedDay && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footer}>
              <Pressable onPress={() => setOpen(false)} style={styles.footerBtn}>
                <Text style={styles.footerCancel}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const today = clampDate(new Date(), minDate, maxDate);
                  if (!isDisabled(today)) {
                    onChange(toDateValue(today));
                    setOpen(false);
                  }
                }}
                style={styles.footerBtn}
              >
                <Text style={styles.footerToday}>Hoje</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    textTransform: 'capitalize',
  },
  placeholder: {
    color: colors.inkMuted,
    textTransform: 'none',
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
  dialogWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  monthTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    color: colors.inkMuted,
    paddingVertical: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  daySelected: {
    backgroundColor: colors.accent,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dayDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.ink,
  },
  dayOutside: {
    color: colors.inkMuted,
  },
  dayTextSelected: {
    color: colors.white,
  },
  dayTextDisabled: {
    color: colors.inkMuted,
  },
  footer: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  footerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  footerCancel: {
    fontFamily: fonts.uiSemi,
    color: colors.inkSoft,
    fontSize: 14,
  },
  footerToday: {
    fontFamily: fonts.uiSemi,
    color: colors.accent,
    fontSize: 14,
  },
});
