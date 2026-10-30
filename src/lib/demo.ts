import type { AppData, IsoDate, Patient } from '../types.ts';
import { addDays } from './dates.ts';
import { createEmptyData } from './data.ts';

/** Три вымышленных пациента и график смен — посмотреть, как всё работает. */
export const createDemoData = (today: IsoDate): AppData => {
  const stamp = new Date().toISOString();
  const base = {
    apartment: '',
    entrance: '',
    floor: '',
    intercom: '',
    comment: '',
    oxygen: false,
    allergy: '',
    wounds: '',
    hospital: null,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const patients: Patient[] = [
    {
      ...base,
      id: 'demo-1',
      fullName: 'Иванова Галина Петровна',
      policy: '7700 1234 5678 0001',
      address: 'Москва, ул. Ленина, 15',
      apartment: '4',
      entrance: '2',
      floor: '3',
      intercom: '45К',
      phones: [
        { number: '+7 909 909-97-97', who: 'Пациентка' },
        { number: '+7 909 111-22-33', who: 'Марина, дочь — звонить вечером' },
      ],
      comment: 'Лежачая, переворачивать вдвоём. Приходить до обеда.',
      schedule: { kind: 'every', days: 1, start: addDays(today, -12) },
      catheter: { type: 'urinary', size: 16 },
      allergy: 'Йод',
      wounds: 'Крестец, 2 стадия',
    },
    {
      ...base,
      id: 'demo-2',
      fullName: 'Петров Николай Сергеевич',
      policy: '7700 2345 6789 0002',
      address: 'Москва, Профсоюзная ул., 104',
      apartment: '12',
      entrance: '1',
      floor: '5',
      phones: [{ number: '+7 916 222-33-44', who: 'Пациент' }],
      schedule: { kind: 'every', days: 3, start: addDays(today, -9) },
      catheter: { type: 'none', size: null },
      oxygen: true,
    },
    {
      ...base,
      id: 'demo-3',
      fullName: 'Смирнова Анна Викторовна',
      policy: '7700 3456 7890 0003',
      address: 'Москва, Ленинский пр-т, 32',
      apartment: '7',
      phones: [{ number: '+7 925 555-66-77', who: 'Олег, сын' }],
      schedule: { kind: 'every', days: 7, start: addDays(today, 1) },
      catheter: { type: 'cysto', size: 18 },
    },
  ];
  const empty = createEmptyData();
  return { ...empty, patients, shifts: { work: 1, off: 2, start: today, hours: '08:00–20:00', overrides: {} } };
};
