import type { IsoDate, Patient, Staff, Visit } from '../types.ts';
import { addDays, daysBetween, formatDots } from './dates.ts';
import { patientsOn, scheduleLabel } from './schedule.ts';

export type Period = { from: IsoDate; to: IsoDate };

export type StaffLine = { user: Staff; visits: number; patients: number; today: number };
export type Missed = { patient: Patient; date: IsoDate };

export type Report = {
  planned: number;
  done: number;
  missed: Missed[];
  patients: number;
  byStaff: StaffLine[];
  visits: Visit[];
};

/** Пациенты сотрудника — те, за кем он закреплён. who = null — все. */
export const assigned = (patients: Patient[], who: string | null) =>
  who ? patients.filter((p) => p.doctorId === who || p.nurseId === who) : patients;

/**
 * Отчёт за период. Будущие дни не считаются: пропуск — это визит по графику до вчерашнего дня, у которого нет отметки.
 * Сегодняшний день — в плане и выполненных, но в пропуски не попадает: день ещё идёт.
 */
export const buildReport = (patients: Patient[], visits: Visit[], users: Staff[], period: Period, today: IsoDate, who: string | null): Report => {
  const list = assigned(patients, who);
  const ids = new Set(list.map((p) => p.id));
  const end = period.to < today ? period.to : today;
  const inPeriod = visits.filter((v) => v.date >= period.from && v.date <= period.to && ids.has(v.patientId) && (!who || v.userId === who));
  const visited = new Set(visits.map((v) => `${v.patientId}|${v.date}`));

  let planned = 0;
  const missed: Missed[] = [];
  for (let i = 0; i <= daysBetween(period.from, end); i += 1) {
    const date = addDays(period.from, i);
    for (const patient of patientsOn(list, date)) {
      planned += 1;
      if (date < today && !visited.has(`${patient.id}|${date}`)) missed.push({ patient, date });
    }
  }

  const field = users.filter((u) => (u.role === 'doctor' || u.role === 'nurse') && (!who || u.id === who));
  const todayList = patientsOn(patients, today);
  const byStaff = field.map((user) => ({
    user,
    visits: visits.filter((v) => v.userId === user.id && v.date >= period.from && v.date <= period.to).length,
    patients: assigned(patients, user.id).filter((p) => !p.archived).length,
    today: assigned(todayList, user.id).length,
  }));

  return {
    planned,
    done: inPeriod.length,
    missed: missed.sort((a, b) => b.date.localeCompare(a.date)),
    patients: list.filter((p) => !p.archived).length,
    byStaff,
    visits: inPeriod.sort((a, b) => b.date.localeCompare(a.date)),
  };
};

const nameOf = (users: Staff[], id: string | null) => users.find((u) => u.id === id)?.name ?? '';

export const visitsTable = (report: Report, patients: Patient[], users: Staff[]) => [
  ['Дата', 'Пациент', 'Адрес', 'Кто был', 'Должность'],
  ...report.visits.map((v) => {
    const p = patients.find((x) => x.id === v.patientId);
    const u = users.find((x) => x.id === v.userId);
    return [formatDots(v.date), p?.fullName ?? '', p?.address ?? '', u?.name ?? '', u ? ROLE[u.role] : ''];
  }),
];

export const missedTable = (report: Report, users: Staff[]) => [
  ['Дата', 'Пациент', 'Адрес', 'Врач', 'Медсестра'],
  ...report.missed.map(({ patient, date }) => [formatDots(date), patient.fullName, patient.address, nameOf(users, patient.doctorId), nameOf(users, patient.nurseId)]),
];

export const patientsTable = (patients: Patient[], users: Staff[]) => [
  ['ФИО', 'Полис', 'Адрес', 'Кв.', 'Телефон', 'График', 'Врач', 'Медсестра', 'Статус'],
  ...patients.map((p) => [
    p.fullName,
    p.policy,
    p.address,
    p.apartment,
    p.phones.map((ph) => `${ph.number}${ph.who ? ` (${ph.who})` : ''}`).join(', '),
    scheduleLabel(p.schedule),
    nameOf(users, p.doctorId),
    nameOf(users, p.nurseId),
    p.archived ? 'архив' : p.hospital ? 'в больнице' : 'наблюдается',
  ]),
];

const ROLE = { head: 'Заведующая', senior: 'Старшая медсестра', doctor: 'Врач', nurse: 'Медсестра' } as const;
