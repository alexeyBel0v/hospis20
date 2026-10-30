import type { IsoDate, Patient, Schedule } from '../types.ts';
import { addDays, daysBetween, pluralRu } from './dates.ts';

export const INTERVALS = [1, 2, 3, 4, 5, 7] as const;

/** Активен ли пациент для графика: не в архиве и не в больнице. */
export const isActive = (patient: Patient): boolean => !patient.archived && !patient.hospital;

/** Есть ли визит по графику в эту дату. */
export const isVisitDay = (schedule: Schedule, date: IsoDate): boolean => {
  if (schedule.kind === 'dates') return schedule.dates.includes(date);
  const diff = daysBetween(schedule.start, date);
  return diff >= 0 && diff % Math.max(1, schedule.days) === 0;
};

/** Ближайший визит в дату from или позже. null — визитов больше нет. */
export const nextVisitDate = (schedule: Schedule, from: IsoDate): IsoDate | null => {
  if (schedule.kind === 'dates') return [...schedule.dates].sort().find((date) => date >= from) ?? null;
  const step = Math.max(1, schedule.days);
  const diff = daysBetween(schedule.start, from);
  if (diff <= 0) return schedule.start;
  return addDays(schedule.start, Math.ceil(diff / step) * step);
};

/** Несколько ближайших визитов начиная с from. */
export const upcomingVisits = (schedule: Schedule, from: IsoDate, count: number): IsoDate[] => {
  const result: IsoDate[] = [];
  let cursor: IsoDate | null = nextVisitDate(schedule, from);
  while (cursor && result.length < count) {
    result.push(cursor);
    cursor = nextVisitDate(schedule, addDays(cursor, 1));
  }
  return result;
};

const byName = (a: Patient, b: Patient) => a.fullName.localeCompare(b.fullName, 'ru');

/** Пациенты с визитом в этот день, по алфавиту. */
export const patientsOn = (patients: Patient[], date: IsoDate): Patient[] =>
  patients.filter((patient) => isActive(patient) && isVisitDay(patient.schedule, date)).sort(byName);

/** «каждый день», «раз в 3 дня», «свои даты» */
export const scheduleLabel = (schedule: Schedule): string => {
  if (schedule.kind === 'dates') return 'свои даты';
  if (schedule.days === 1) return 'каждый день';
  return `раз в ${schedule.days} ${pluralRu(schedule.days, 'день', 'дня', 'дней')}`;
};

/** «1/3», «ежедн.», «даты» */
export const scheduleShort = (schedule: Schedule): string => {
  if (schedule.kind === 'dates') return 'даты';
  return schedule.days === 1 ? 'ежедн.' : `1/${schedule.days}`;
};
