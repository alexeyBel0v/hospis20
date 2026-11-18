import { describe, expect, it } from 'vitest';
import type { Patient } from '../types.ts';
import { emptyInput } from './patients.ts';
import { buildReport } from './report.ts';

const patient = (id: string, nurseId: string, days: number): Patient => ({
  ...emptyInput('2026-11-01'),
  id,
  fullName: id,
  schedule: { kind: 'every', days, start: '2026-11-01' },
  doctorId: null,
  nurseId,
  hospital: null,
  geo: null,
  archived: false,
  createdAt: '',
  updatedAt: '',
});

const users = [
  { id: 'n1', name: 'Павлова', role: 'nurse' as const },
  { id: 'n2', name: 'Иванова', role: 'nurse' as const },
];

describe('buildReport', () => {
  const patients = [patient('a', 'n1', 2), patient('b', 'n2', 7)];
  // a: 1, 3, 5, 7 ноября; b: 1, 8 ноября. Сегодня 7-е — 7-е не пропуск, день идёт.
  const visits = [
    { id: 'v1', patientId: 'a', date: '2026-11-01', userId: 'n1', at: '', note: '' },
    { id: 'v2', patientId: 'a', date: '2026-11-05', userId: 'n1', at: '', note: '' },
    { id: 'v3', patientId: 'b', date: '2026-11-01', userId: 'n2', at: '', note: '' },
  ];

  it('считает план, выполненные и пропуски до вчера', () => {
    const r = buildReport(patients, visits, users, { from: '2026-11-01', to: '2026-11-30' }, '2026-11-07', null);
    expect(r.planned).toBe(5);
    expect(r.done).toBe(3);
    expect(r.missed.map((m) => `${m.patient.id}${m.date.slice(8)}`)).toEqual(['a03']);
    expect(r.byStaff.find((s) => s.user.id === 'n1')?.visits).toBe(2);
    expect(r.byStaff.find((s) => s.user.id === 'n1')?.today).toBe(1);
  });

  it('по одному сотруднику — только его пациенты и его отметки', () => {
    const r = buildReport(patients, visits, users, { from: '2026-11-01', to: '2026-11-30' }, '2026-11-07', 'n2');
    expect(r.planned).toBe(1);
    expect(r.done).toBe(1);
    expect(r.byStaff).toHaveLength(1);
  });
});
