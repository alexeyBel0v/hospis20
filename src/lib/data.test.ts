import { describe, expect, it } from 'vitest';
import { parseData, parseDataJson, DataError } from './data.ts';
import { parseBlocks, parseNews } from './content.ts';
import { addressWarning, splitApartment, routeUrl } from './address.ts';
import { formatPhone, formatPolicy } from './masks.ts';
import { shortName } from './format.ts';

describe('старые копии', () => {
  it('переводит пациента из прошлой версии (nextVisitDate + intervalDays)', () => {
    const data = parseData({
      schemaVersion: 1,
      patients: [
        {
          id: 'a', fullName: 'Петров Николай', policy: '7700234567890002', address: 'ул. Ленина, 15, кв. 4', phone: '89161234567',
          intervalDays: 3, nextVisitDate: '2026-10-01', catheter: { type: 'urinary', size: 16 },
          allergy: { has: true, items: ['Йод'], note: '' }, wounds: { sacrum: 2 }, archived: false,
        },
      ],
      visits: [{ id: 'v', patientId: 'a', date: '2026-09-28' }],
    });
    const p = data.patients[0];
    expect(p?.schedule).toEqual({ kind: 'every', days: 3, start: '2026-10-01' });
    expect(p?.address).toBe('ул. Ленина, 15');
    expect(p?.apartment).toBe('4');
    expect(p?.phones).toEqual([{ number: '+7 916 123-45-67', who: 'Пациент' }]);
    expect(p?.policy).toBe('7700 2345 6789 0002');
    expect(p?.allergy).toBe('Йод');
    expect(p?.catheter).toEqual({ type: 'urinary', size: 16 });
  });

  it('понятно ругается на чужой текст', () => {
    expect(() => parseDataJson('привет')).toThrow(DataError);
    expect(() => parseData({ foo: 1 })).toThrow(DataError);
  });
});

describe('новости', () => {
  it('разбирает файл: инструкция сверху не попадает, новые сверху, «!» — важная', () => {
    const news = parseNews('# Новости\nинструкция\n## 28.10.2026 Старая\nтекст\n## 30.10.2026 ! Срочно\nважно');
    expect(news.map((n) => n.title)).toEqual(['Срочно', 'Старая']);
    expect(news[0]?.important).toBe(true);
    expect(news[0]?.date).toBe('2026-10-30');
  });

  it('абзацы, списки, контакты', () => {
    const blocks = parseBlocks('Первый\nабзац\n\n- раз\n- два\n| Анна | Диспетчер | +7 900 000-00-00');
    expect(blocks).toEqual([
      { kind: 'p', text: 'Первый абзац' },
      { kind: 'list', items: ['раз', 'два'] },
      { kind: 'contact', name: 'Анна', role: 'Диспетчер', phone: '+7 900 000-00-00' },
    ]);
  });
});

describe('мелочи', () => {
  it('маски', () => {
    expect(formatPolicy('7700a1234567800019')).toBe('7700 1234 5678 0001');
    expect(formatPhone('89099099797')).toBe('+7 909 909-97-97');
  });
  it('адрес', () => {
    expect(splitApartment('Москва, ул. Ленина, 15, кв. 4')).toEqual({ address: 'Москва, ул. Ленина, 15', apartment: '4' });
    expect(addressWarning('ул. Ленина 15')).toContain('город');
    expect(addressWarning('Москва, ул. Ленина, 15')).toBe('');
    expect(routeUrl(['А', 'Б'])).toBe('https://yandex.ru/maps/?rtext=~%D0%90~%D0%91&rtt=auto');
  });
  it('Фамилия И. О.', () => {
    expect(shortName('Петров Николай Сергеевич')).toBe('Петров Н. С.');
    expect(shortName('Петров')).toBe('Петров');
  });
});
