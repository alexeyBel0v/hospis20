import type { AppData, CatheterType, IsoDate, Patient, Phone, Schedule, Settings, Shifts, ThemeChoice } from '../types.ts';
import { splitApartment } from './address.ts';
import { isIsoDate, todayIso } from './dates.ts';
import { formatPhone, formatPolicy } from './masks.ts';
import { newId } from './patients.ts';
import { EMPTY_SHIFTS } from './shifts.ts';

export class DataError extends Error {}

export const DEFAULT_SETTINGS: Settings = { theme: 'auto', seenNews: [] };

export const createEmptyData = (): AppData => ({
  version: 2,
  patients: [],
  shifts: { ...EMPTY_SHIFTS, overrides: {} },
  settings: { ...DEFAULT_SETTINGS, seenNews: [] },
  savedAt: '',
});

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (r: Rec, key: string): string => (typeof r[key] === 'string' ? (r[key] as string) : '');
const num = (r: Rec, key: string): number | null => (typeof r[key] === 'number' && Number.isFinite(r[key]) ? (r[key] as number) : null);

const parsePhones = (r: Rec): Phone[] => {
  if (Array.isArray(r.phones)) {
    return r.phones
      .filter(isRec)
      .map((p) => ({ number: formatPhone(str(p, 'number')), who: str(p, 'who') }))
      .filter((p) => p.number.length > 2);
  }
  const single = str(r, 'phone');
  return single ? [{ number: formatPhone(single), who: 'Пациент' }] : [];
};

/** Новый формат — schedule; старые версии хранили nextVisitDate + intervalDays. */
const parseSchedule = (r: Rec, fallback: IsoDate): Schedule => {
  const s = r.schedule;
  if (isRec(s)) {
    if (s.kind === 'dates' && Array.isArray(s.dates)) return { kind: 'dates', dates: s.dates.filter(isIsoDate).sort() };
    const days = num(s, 'days');
    const start = s.start;
    if (days && days >= 1 && isIsoDate(start)) return { kind: 'every', days: Math.round(days), start };
  }
  const interval = num(r, 'intervalDays') ?? 3;
  const start = isIsoDate(r.nextVisitDate) ? r.nextVisitDate : isIsoDate(r.firstVisitDate) ? r.firstVisitDate : fallback;
  return { kind: 'every', days: Math.max(1, Math.round(interval)), start };
};

const CATHETERS: CatheterType[] = ['none', 'urinary', 'cysto', 'other'];

const parseCatheter = (value: unknown): Patient['catheter'] => {
  if (value === true) return { type: 'other', size: null };
  if (!isRec(value)) return { type: 'none', size: null };
  const type = CATHETERS.find((t) => t === value.type) ?? 'none';
  const size = num(value, 'size');
  return type === 'none' ? { type, size: null } : { type, size };
};

const parseAllergy = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!isRec(value) || value.has !== true) return '';
  const items = Array.isArray(value.items) ? value.items.filter((i): i is string => typeof i === 'string') : [];
  return [items.join(', '), str(value, 'note')].filter(Boolean).join('; ') || 'есть';
};

const parseWounds = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!isRec(value)) return '';
  const count = Object.keys(value).length;
  return count ? `отмечено зон: ${count} (из старой версии)` : '';
};

const parseHospital = (value: unknown): Patient['hospital'] =>
  isRec(value) && isIsoDate(value.since) ? { since: value.since, note: str(value, 'note') } : null;

const parseGeo = (value: unknown): Patient['geo'] => {
  if (!isRec(value) || typeof value.for !== 'string') return null;
  const lat = num(value, 'lat');
  const lon = num(value, 'lon');
  return { for: value.for, lat: lat !== null && lon !== null ? lat : null, lon: lat !== null && lon !== null ? lon : null };
};

const parsePatient = (value: unknown, index: number, today: IsoDate): Patient => {
  if (!isRec(value)) throw new DataError(`Пациент №${index + 1}: неверный формат`);
  const fullName = str(value, 'fullName').trim();
  if (!fullName) throw new DataError(`Пациент №${index + 1}: нет ФИО`);
  const hasNewAddress = 'apartment' in value;
  const legacy = hasNewAddress ? null : splitApartment(str(value, 'address'));
  return {
    id: str(value, 'id') || newId(),
    fullName,
    policy: formatPolicy(str(value, 'policy')),
    address: legacy ? legacy.address : str(value, 'address'),
    apartment: legacy ? legacy.apartment : str(value, 'apartment'),
    entrance: str(value, 'entrance'),
    floor: str(value, 'floor'),
    intercom: str(value, 'intercom'),
    phones: parsePhones(value),
    comment: str(value, 'comment'),
    schedule: parseSchedule(value, today),
    catheter: parseCatheter(value.catheter),
    oxygen: value.oxygen === true,
    allergy: parseAllergy(value.allergy),
    wounds: parseWounds(value.wounds),
    hospital: parseHospital(value.hospital),
    geo: parseGeo(value.geo),
    archived: value.archived === true,
    createdAt: str(value, 'createdAt'),
    updatedAt: str(value, 'updatedAt'),
  };
};

const parseShifts = (value: unknown): Shifts => {
  if (!isRec(value)) return { ...EMPTY_SHIFTS, overrides: {} };
  const overrides: Shifts['overrides'] = {};
  if (isRec(value.overrides)) {
    for (const [date, mark] of Object.entries(value.overrides)) {
      if (isIsoDate(date) && (mark === 'work' || mark === 'off')) overrides[date] = mark;
    }
  }
  const start = isIsoDate(value.start) ? value.start : '';
  return {
    work: Math.max(0, Math.round(num(value, 'work') ?? 0)),
    off: Math.max(0, Math.round(num(value, 'off') ?? 0)),
    start,
    hours: str(value, 'hours'),
    overrides,
  };
};

const THEMES: ThemeChoice[] = ['auto', 'light', 'dark'];

const parseSettings = (value: unknown): Settings => {
  if (!isRec(value)) return { ...DEFAULT_SETTINGS, seenNews: [] };
  return {
    theme: THEMES.find((t) => t === value.theme) ?? 'auto',
    seenNews: Array.isArray(value.seenNews) ? value.seenNews.filter((v): v is string => typeof v === 'string').slice(-200) : [],
  };
};

/** Принимает данные любой версии Hospis OS (в том числе старые резервные копии). */
export const parseData = (value: unknown, today: IsoDate = todayIso()): AppData => {
  if (!isRec(value)) throw new DataError('Это не резервная копия Hospis OS');
  const source = isRec(value.data) ? value.data : value;
  if (!Array.isArray(source.patients)) throw new DataError('В файле нет списка пациентов');
  return {
    version: 2,
    patients: source.patients.map((p, i) => parsePatient(p, i, today)),
    shifts: parseShifts(source.shifts),
    settings: parseSettings(source.settings),
    savedAt: str(source, 'savedAt'),
  };
};

export const parseDataJson = (text: string): AppData => {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new DataError('Текст не похож на резервную копию: проверьте, что скопирован целиком');
  }
  return parseData(value);
};
