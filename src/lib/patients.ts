import type { AppData, IsoDate, Patient, PatientInput } from '../types.ts';
import { normalizeAddress } from './address.ts';
import { formatPhone, formatPolicy } from './masks.ts';

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const emptyInput = (today: IsoDate): PatientInput => ({
  fullName: '',
  policy: '',
  address: '',
  apartment: '',
  entrance: '',
  floor: '',
  intercom: '',
  phones: [{ number: '', who: '' }],
  comment: '',
  schedule: { kind: 'every', days: 3, start: today },
  catheter: { type: 'none', size: null },
  oxygen: false,
  allergy: '',
  wounds: '',
});

const clean = (input: PatientInput): PatientInput => ({
  ...input,
  fullName: input.fullName.trim().replace(/\s+/g, ' '),
  policy: formatPolicy(input.policy),
  address: normalizeAddress(input.address),
  apartment: input.apartment.trim(),
  entrance: input.entrance.trim(),
  floor: input.floor.trim(),
  intercom: input.intercom.trim(),
  phones: input.phones
    .map((phone) => ({ number: formatPhone(phone.number), who: phone.who.trim() }))
    .filter((phone) => phone.number.length > 2),
  comment: input.comment.trim(),
  schedule:
    input.schedule.kind === 'dates'
      ? { kind: 'dates', dates: [...new Set(input.schedule.dates)].sort() }
      : { ...input.schedule, days: Math.max(1, Math.round(input.schedule.days)) },
  catheter: input.catheter.type === 'none' ? { type: 'none', size: null } : input.catheter,
  allergy: input.allergy.trim(),
  wounds: input.wounds.trim(),
});

export const toInput = (p: Patient): PatientInput => ({
  fullName: p.fullName,
  policy: p.policy,
  address: p.address,
  apartment: p.apartment,
  entrance: p.entrance,
  floor: p.floor,
  intercom: p.intercom,
  phones: p.phones.length ? p.phones.map((phone) => ({ ...phone })) : [{ number: '', who: '' }],
  comment: p.comment,
  schedule: p.schedule.kind === 'dates' ? { kind: 'dates', dates: [...p.schedule.dates] } : { ...p.schedule },
  catheter: { ...p.catheter },
  oxygen: p.oxygen,
  allergy: p.allergy,
  wounds: p.wounds,
});

const now = () => new Date().toISOString();

const mapPatient = (data: AppData, id: string, change: (p: Patient) => Patient): AppData => ({
  ...data,
  patients: data.patients.map((p) => (p.id === id ? { ...change(p), updatedAt: now() } : p)),
});

export const addPatient = (data: AppData, input: PatientInput, id: string = newId()): { data: AppData; id: string } => {
  const stamp = now();
  const patient: Patient = { ...clean(input), id, hospital: null, archived: false, createdAt: stamp, updatedAt: stamp };
  return { data: { ...data, patients: [...data.patients, patient] }, id };
};

export const updatePatient = (data: AppData, id: string, input: PatientInput): AppData =>
  mapPatient(data, id, (p) => ({ ...p, ...clean(input) }));

export const setArchived = (data: AppData, id: string, archived: boolean): AppData => mapPatient(data, id, (p) => ({ ...p, archived }));

export const setHospital = (data: AppData, id: string, hospital: Patient['hospital']): AppData =>
  mapPatient(data, id, (p) => ({ ...p, hospital }));

/** Выписали: снимаем паузу, график «каждые N дней» продолжается с выбранной даты. */
export const discharge = (data: AppData, id: string, from: IsoDate): AppData =>
  mapPatient(data, id, (p) => ({
    ...p,
    hospital: null,
    schedule: p.schedule.kind === 'every' ? { ...p.schedule, start: from } : p.schedule,
  }));

export const removePatient = (data: AppData, id: string): AppData => ({ ...data, patients: data.patients.filter((p) => p.id !== id) });

const digitsOnly = (text: string) => text.replace(/\D/g, '');

/** Поиск по ФИО, полису, телефону, адресу. */
export const matches = (p: Patient, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [p.fullName, p.address, p.comment].join(' ').toLowerCase();
  if (q.split(/\s+/).every((word) => text.includes(word))) return true;
  const qDigits = digitsOnly(q);
  if (qDigits.length < 3) return false;
  return [p.policy, ...p.phones.map((phone) => phone.number)].some((value) => digitsOnly(value).includes(qDigits));
};

export const findDuplicateByPolicy = (patients: Patient[], policy: string, exceptId?: string): Patient | undefined => {
  const key = digitsOnly(policy);
  if (key.length < 16) return undefined;
  return patients.find((p) => p.id !== exceptId && digitsOnly(p.policy) === key);
};
