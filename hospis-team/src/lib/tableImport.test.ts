import { describe, expect, it } from 'vitest';
import { parseTable } from './tableImport.ts';

const staff = [
  { id: 'd1', name: 'Григорьев Сергей', role: 'doctor' as const },
  { id: 'n1', name: 'Павлова Мария', role: 'nurse' as const },
];

describe('parseTable', () => {
  it('читает строки из Excel с заголовком в любом порядке', () => {
    const text = 'Адрес\tФИО\tТелефон\tГрафик\tДата первого визита\tМедсестра\nМосква, ул. Вавилова, 1\tИванов Иван Иванович\t89161234567\t1/3\t20.11.2026\tПавлова';
    const row = parseTable(text, '2026-11-18', staff)[0]!;
    expect(row.patient?.fullName).toBe('Иванов Иван Иванович');
    expect(row.patient?.address).toBe('Москва, ул. Вавилова, 1');
    expect(row.patient?.schedule).toEqual({ kind: 'every', days: 3, start: '2026-11-20' });
    expect(row.patient?.nurseId).toBe('n1');
    expect(row.patient?.phones[0]?.number).toContain('916');
  });

  it('без заголовка — порядок шаблона, CSV через точку с запятой', () => {
    const rows = parseTable('Петрова Анна;;Москва, ул. Обручева, 5;7\n;;пустая', '2026-11-18', staff);
    expect(rows[0]!.patient?.apartment).toBe('7');
    expect(rows[0]!.patient?.schedule).toEqual({ kind: 'every', days: 3, start: '2026-11-18' });
    expect(rows[1]!.patient).toBeNull();
  });

  it('понимает «ежедневно» и предупреждает о непонятной дате', () => {
    const row = parseTable('ФИО;График;Первый визит\nСидоров;ежедневно;завтра', '2026-11-18', staff)[0]!;
    expect(row.patient?.schedule).toEqual({ kind: 'every', days: 1, start: '2026-11-18' });
    expect(row.problem).toContain('дату');
  });
});
