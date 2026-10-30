import { describe, expect, it } from 'vitest';
import type { Shifts } from '../types.ts';
import { isWorkDay, nextWorkDay, toggleDay } from './shifts.ts';

const shifts = (work: number, off: number, start: string): Shifts => ({ work, off, start, hours: '', overrides: {} });

describe('смены', () => {
  it('сутки через трое', () => {
    const s = shifts(1, 3, '2026-10-30');
    expect(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'].map((d) => isWorkDay(s, d))).toEqual([true, false, false, false, true]);
    expect(isWorkDay(s, '2026-10-26')).toBe(true);
  });

  it('2 через 2', () => {
    const s = shifts(2, 2, '2026-10-01');
    expect(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map((d) => isWorkDay(s, d))).toEqual([true, true, false, false, true]);
  });

  it('ручная отметка меняет день и снимается повторным нажатием', () => {
    const s = shifts(1, 3, '2026-10-30');
    const swapped = toggleDay(s, '2026-10-31');
    expect(isWorkDay(swapped, '2026-10-31')).toBe(true);
    const back = toggleDay(swapped, '2026-10-31');
    expect(back.overrides).toEqual({});
    expect(isWorkDay(toggleDay(s, '2026-10-30'), '2026-10-30')).toBe(false);
  });

  it('ближайшая смена', () => {
    expect(nextWorkDay(shifts(1, 3, '2026-10-30'), '2026-10-31')).toBe('2026-11-03');
    expect(nextWorkDay(shifts(0, 0, ''), '2026-10-31')).toBeNull();
  });
});
