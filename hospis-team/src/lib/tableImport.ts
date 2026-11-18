import type { IsoDate, Patient, Schedule, Staff } from '../types.ts';
import { isIsoDate } from './dates.ts';
import { formatPhone, formatPolicy } from './masks.ts';
import { emptyInput, newId } from './patients.ts';

/**
 * Пациенты из таблицы: строки, скопированные из Excel/Google-таблицы (через табуляцию) или CSV (через «;»).
 * Первая строка может быть заголовком — тогда столбцы узнаются по названию и могут идти в любом порядке.
 * Без заголовка — порядок как в шаблоне.
 */

type Column = 'fullName' | 'policy' | 'address' | 'apartment' | 'entrance' | 'floor' | 'intercom' | 'phone' | 'who' | 'every' | 'start' | 'doctor' | 'nurse' | 'comment';

export const TEMPLATE_COLUMNS: Array<{ id: Column; title: string; example: string }> = [
  { id: 'fullName', title: 'ФИО', example: 'Иванов Иван Иванович' },
  { id: 'policy', title: 'Полис', example: '7755 1234 5678 9012' },
  { id: 'address', title: 'Адрес', example: 'Москва, ул. Профсоюзная, 56' },
  { id: 'apartment', title: 'Квартира', example: '12' },
  { id: 'entrance', title: 'Подъезд', example: '2' },
  { id: 'floor', title: 'Этаж', example: '5' },
  { id: 'intercom', title: 'Домофон', example: '12В' },
  { id: 'phone', title: 'Телефон', example: '+7 916 123-45-67' },
  { id: 'who', title: 'Чей телефон', example: 'Дочь' },
  { id: 'every', title: 'Раз в N дней', example: '3' },
  { id: 'start', title: 'Первый визит', example: '20.11.2026' },
  { id: 'doctor', title: 'Врач', example: 'Григорьев' },
  { id: 'nurse', title: 'Медсестра', example: 'Павлова' },
  { id: 'comment', title: 'Комментарий', example: 'Ключ у соседки' },
];

const HEADER_WORDS: Array<[Column, RegExp]> = [
  ['fullName', /фио|пациент|фамилия/],
  ['policy', /полис|омс/],
  ['address', /адрес/],
  ['apartment', /кв/],
  ['entrance', /подъезд|под\./],
  ['floor', /этаж/],
  ['intercom', /домофон|код/],
  ['who', /чей|кем|контакт/],
  ['phone', /тел/],
  ['every', /график|раз в|интервал|дн/],
  ['start', /перв|дата|начал/],
  ['doctor', /врач/],
  ['nurse', /сестр|м\/с/],
  ['comment', /коммент|примеч/],
];

const splitRow = (line: string): string[] => {
  const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
  if (!sep) return [line];
  return line.split(sep).map((cell) => cell.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
};

const detectHeader = (cells: string[]): Column[] | null => {
  const found = cells.map((cell) => {
    const text = cell.toLowerCase();
    return HEADER_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  });
  if (!found.includes('fullName') || found.filter(Boolean).length < 2) return null;
  return found.map((c) => c ?? ('comment' as Column));
};

/** «20.11.2026», «20.11.26», «2026-11-20» → ISO. */
const parseDate = (text: string): IsoDate | null => {
  const t = text.trim();
  if (isIsoDate(t)) return t;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(t);
  if (!m) return null;
  const [, day = '', month = '', y = ''] = m;
  const year = y.length === 2 ? `20${y}` : y;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
};

/** «3», «1/3», «раз в 3 дня», «ежедневно». */
const parseEvery = (text: string): number | null => {
  const t = text.toLowerCase();
  if (/ежеднев|каждый день/.test(t)) return 1;
  if (/недел/.test(t)) return 7;
  const m = /(\d+)\s*$/.exec(t.replace(/дн(я|ей)?|раз/g, '').trim()) ?? /(\d+)/.exec(t);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 60 ? n : null;
};

const findStaff = (staff: Staff[], role: Staff['role'], text: string): string | null => {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const surname = t.split(/\s+/)[0] ?? t;
  return staff.find((s) => s.role === role && s.name.toLowerCase().startsWith(surname))?.id ?? null;
};

export type TableRow = { line: number; patient: Patient | null; problem: string };

export const parseTable = (text: string, today: IsoDate, staff: Staff[]): TableRow[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = detectHeader(splitRow(lines[0] ?? ''));
  const columns = header ?? TEMPLATE_COLUMNS.map((c) => c.id);
  const body = header ? lines.slice(1) : lines;
  const offset = header ? 2 : 1;
  const stamp = new Date().toISOString();

  return body.map((line, i) => {
    const cells = splitRow(line);
    const get = (col: Column) => {
      const index = columns.indexOf(col);
      return index >= 0 ? (cells[index] ?? '').trim() : '';
    };
    const fullName = get('fullName').replace(/\s+/g, ' ');
    if (!fullName) return { line: i + offset, patient: null, problem: 'нет ФИО' };
    const every = get('every') ? parseEvery(get('every')) : 3;
    const start = get('start') ? parseDate(get('start')) : today;
    const problems = [every === null && 'график не понял — поставил раз в 3 дня', start === null && 'дату не понял — поставил сегодня'].filter(Boolean);
    const schedule: Schedule = { kind: 'every', days: every ?? 3, start: start ?? today };
    const phone = get('phone');
    const base = emptyInput(today);
    return {
      line: i + offset,
      problem: problems.join(', '),
      patient: {
        ...base,
        id: newId(),
        fullName,
        policy: formatPolicy(get('policy')),
        address: get('address'),
        apartment: get('apartment'),
        entrance: get('entrance'),
        floor: get('floor'),
        intercom: get('intercom'),
        phones: phone ? [{ number: formatPhone(phone), who: get('who') }] : [],
        comment: get('comment'),
        schedule,
        doctorId: findStaff(staff, 'doctor', get('doctor')),
        nurseId: findStaff(staff, 'nurse', get('nurse')),
        hospital: null,
        geo: null,
        archived: false,
        createdAt: stamp,
        updatedAt: stamp,
      },
    };
  });
};

/** Шаблон для Excel: CSV через «;» с BOM — Excel откроет кириллицу и разложит по столбцам. */
export const templateCsv = (): string =>
  `﻿${[TEMPLATE_COLUMNS.map((c) => c.title), TEMPLATE_COLUMNS.map((c) => c.example)].map((row) => row.join(';')).join('\r\n')}\r\n`;
