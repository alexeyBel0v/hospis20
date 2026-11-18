import type { IsoDate, Shifts } from '../types.ts';
import { addDays, daysBetween } from './dates.ts';

export type ShiftPreset = { id: string; label: string; work: number; off: number };

export const SHIFT_PRESETS: ShiftPreset[] = [
  { id: '1-3', label: 'Сутки через трое', work: 1, off: 3 },
  { id: '2-2', label: '2 через 2', work: 2, off: 2 },
  { id: '5-2', label: '5/2', work: 5, off: 2 },
  { id: '1-1', label: 'День через день', work: 1, off: 1 },
  { id: '1-2', label: 'Сутки через двое', work: 1, off: 2 },
];

export const EMPTY_SHIFTS: Shifts = { work: 0, off: 0, start: '', hours: '', overrides: {} };

/** Работаю ли в этот день: сначала ручная отметка, потом график. */
export const isWorkDay = (shifts: Shifts, date: IsoDate): boolean => {
  const manual = shifts.overrides[date];
  if (manual) return manual === 'work';
  if (shifts.work <= 0 || !shifts.start) return false;
  const cycle = shifts.work + shifts.off;
  const diff = daysBetween(shifts.start, date);
  const position = ((diff % cycle) + cycle) % cycle;
  return position < shifts.work;
};

/** Отметка дня вручную: если совпадает с графиком — ручная отметка убирается. */
export const toggleDay = (shifts: Shifts, date: IsoDate): Shifts => {
  const overrides = { ...shifts.overrides };
  const wasWork = isWorkDay(shifts, date);
  delete overrides[date];
  const byPattern = isWorkDay({ ...shifts, overrides }, date);
  if (byPattern === wasWork) overrides[date] = wasWork ? 'off' : 'work';
  return { ...shifts, overrides };
};

/** Ближайшая смена начиная с from (ищем в пределах двух месяцев). */
export const nextWorkDay = (shifts: Shifts, from: IsoDate): IsoDate | null => {
  for (let i = 0; i < 62; i += 1) {
    const date = addDays(from, i);
    if (isWorkDay(shifts, date)) return date;
  }
  return null;
};

export const hasShifts = (shifts: Shifts): boolean => shifts.work > 0 || Object.keys(shifts.overrides).length > 0;

export const presetOf = (shifts: Shifts): ShiftPreset | undefined =>
  SHIFT_PRESETS.find((preset) => preset.work === shifts.work && preset.off === shifts.off);
