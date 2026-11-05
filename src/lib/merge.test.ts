import { describe, expect, it } from 'vitest';
import { createEmptyData, parseIncomingPatients } from './data.ts';
import { addPatient, emptyInput, mergePatients } from './patients.ts';

describe('добавить пациентов из файла', () => {
  const text = JSON.stringify([
    { fullName: 'Петров Николай Сергеевич', policy: '7700234567890002', address: 'Москва, Профсоюзная ул., 104', schedule: { kind: 'every', days: 3, start: '2026-11-06' } },
    { fullName: 'Смирнова Анна', schedule: { kind: 'every', days: 7, start: '2026-11-07' } },
  ]);

  it('принимает просто список', () => {
    const patients = parseIncomingPatients(text);
    expect(patients.map((p) => p.fullName)).toEqual(['Петров Николай Сергеевич', 'Смирнова Анна']);
    expect(patients[0]?.policy).toBe('7700 2345 6789 0002');
  });

  it('новых добавляет, совпавших по полису или ФИО пропускает', () => {
    let data = createEmptyData();
    data = addPatient(data, { ...emptyInput('2026-11-05'), fullName: 'Другой Человек', policy: '7700 2345 6789 0002' }).data;
    data = addPatient(data, { ...emptyInput('2026-11-05'), fullName: 'смирнова  анна' }).data;
    const result = mergePatients(data, parseIncomingPatients(text));
    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    const fresh = mergePatients(createEmptyData(), parseIncomingPatients(text));
    expect(fresh.added).toHaveLength(2);
    expect(fresh.data.patients).toHaveLength(2);
  });
});
