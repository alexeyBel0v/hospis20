import { describe, expect, it } from 'vitest';
import type { Schedule } from '../types.ts';
import { addDays } from './dates.ts';
import { isVisitDay, nextVisitDate, upcomingVisits } from './schedule.ts';

const every = (days: number, start: string): Schedule => ({ kind: 'every', days, start });

describe('график визитов', () => {
  it('раз в 3 дня от 10.09 — как в ТЗ', () => {
    const s = every(3, '2026-09-10');
    expect(upcomingVisits(s, '2026-09-10', 8)).toEqual([
      '2026-09-10', '2026-09-13', '2026-09-16', '2026-09-19', '2026-09-22', '2026-09-25', '2026-09-28', '2026-10-01',
    ]);
    expect(isVisitDay(s, '2026-09-11')).toBe(false);
    expect(isVisitDay(s, '2026-09-12')).toBe(false);
    expect(isVisitDay(s, '2026-09-13')).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 7])('каждые %i дн.: шаг ровно N дней', (n) => {
    const visits = upcomingVisits(every(n, '2026-10-01'), '2026-10-01', 5);
    visits.slice(1).forEach((date, i) => expect(date).toBe(addDays(visits[i] ?? '', n)));
  });

  it('переход через месяц и год', () => {
    expect(upcomingVisits(every(4, '2026-12-27'), '2026-12-27', 3)).toEqual(['2026-12-27', '2026-12-31', '2027-01-04']);
    expect(nextVisitDate(every(5, '2026-01-28'), '2026-02-01')).toBe('2026-02-02');
  });

  it('до первого визита ближайший — сам первый визит', () => {
    expect(nextVisitDate(every(3, '2026-11-05'), '2026-10-30')).toBe('2026-11-05');
    expect(isVisitDay(every(3, '2026-11-05'), '2026-11-02')).toBe(false);
  });

  it('свои даты', () => {
    const s: Schedule = { kind: 'dates', dates: ['2026-10-06', '2026-10-01', '2026-10-03'] };
    expect(isVisitDay(s, '2026-10-03')).toBe(true);
    expect(nextVisitDate(s, '2026-10-02')).toBe('2026-10-03');
    expect(nextVisitDate(s, '2026-10-07')).toBeNull();
    expect(upcomingVisits(s, '2026-10-01', 5)).toEqual(['2026-10-01', '2026-10-03', '2026-10-06']);
  });
});
