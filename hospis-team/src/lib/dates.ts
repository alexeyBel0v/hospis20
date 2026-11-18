import type { IsoDate } from '../types.ts';

const DAY_MS = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Сегодня в часовом поясе телефона. */
export const todayIso = (now = new Date()): IsoDate => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const isIsoDate = (value: unknown): value is IsoDate => {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const [y = 0, m = 0, d = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Считаем в UTC, чтобы переход на летнее время и часовые пояса не сдвигали дни. */
const toUtc = (date: IsoDate): number => {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number): IsoDate => {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const addDays = (date: IsoDate, days: number): IsoDate => fromUtc(toUtc(date) + days * DAY_MS);

export const daysBetween = (from: IsoDate, to: IsoDate): number => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

/** 0 — понедельник … 6 — воскресенье. */
export const weekdayIndex = (date: IsoDate): number => (new Date(toUtc(date)).getUTCDay() + 6) % 7;

export const firstOfMonth = (date: IsoDate): IsoDate => `${date.slice(0, 8)}01`;

export const addMonths = (date: IsoDate, months: number): IsoDate => {
  const [y = 0, m = 1] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
};

export const daysInMonth = (date: IsoDate): number => {
  const [y = 0, m = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const month = (date: IsoDate) => Number(date.slice(5, 7)) - 1;
const day = (date: IsoDate) => Number(date.slice(8, 10));

/** «30 октября» */
export const formatDayMonth = (date: IsoDate) => `${day(date)} ${MONTHS_GEN[month(date)]}`;
/** «30 окт» */
export const formatDayShort = (date: IsoDate) => `${day(date)} ${MONTHS_SHORT[month(date)]}`;
/** «пятница» */
export const formatWeekday = (date: IsoDate) => WEEKDAYS[weekdayIndex(date)] ?? '';
/** «пт» */
export const formatWeekdayShort = (date: IsoDate) => WEEKDAYS_SHORT[weekdayIndex(date)] ?? '';
/** «Октябрь 2026» */
export const formatMonthYear = (date: IsoDate) => `${MONTHS_NOM[month(date)]} ${date.slice(0, 4)}`;
/** «30.10.2026» */
export const formatDots = (date: IsoDate) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/** «30.10.2026» → «2026-10-30», мусор → null */
export const parseDots = (text: string): IsoDate | null => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const iso = `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`;
  return isIsoDate(iso) ? iso : null;
};

export const pluralRu = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** «сегодня», «завтра», «послезавтра», «пн, 2 ноя» */
export const formatRelative = (date: IsoDate, today: IsoDate): string => {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  return `${formatWeekdayShort(date)}, ${formatDayShort(date)}`;
};
