import {
  addDays,
  format,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Parse YYYY-MM-DD as a local calendar date (noon avoids DST edge cases). */
export function parseDateValue(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const parsed = parseISO(value);
    return isValid(parsed) ? startOfDay(parsed) : null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12, 0, 0, 0);
  return isValid(date) ? date : null;
}

export function toDateValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDateLabel(value?: string | null, fallback = 'Selecionar data'): string {
  const date = parseDateValue(value);
  if (!date) return fallback;
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function todayValue(): string {
  return toDateValue(new Date());
}

export function daysFromTodayValue(days: number): string {
  return toDateValue(addDays(new Date(), days));
}

export function clampDate(date: Date, minimum?: Date | null, maximum?: Date | null): Date {
  let next = date;
  if (minimum && next < minimum) next = minimum;
  if (maximum && next > maximum) next = maximum;
  return next;
}
