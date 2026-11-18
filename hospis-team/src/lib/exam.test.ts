import { describe, expect, it } from 'vitest';
import { emptyExam, examText, morseScore, nortonScore } from './exam.ts';

describe('осмотр медсестры', () => {
  it('считает Нортон и Морсе', () => {
    expect(nortonScore([3, 0, 3, 3, 2])).toBe(1 + 4 + 1 + 1 + 2);
    expect(nortonScore([0, 0, -1, 0, 0])).toBeNull();
    expect(morseScore([1, 1, 0, 0, 0, 1])).toBe(25 + 15 + 15);
  });

  it('помечает незаполненное и собирает текст по шаблону', () => {
    const t = examText({ ...emptyExam(), presence: 'дочери', hr: '78', norton: [3, 0, 3, 3, 2] }, 'Телефон службы.');
    expect(t).toContain('Визит в присутствии дочери. Уход осуществляет [указать кто].');
    expect(t).toContain('ЧСС — 78 уд/мин');
    expect(t).toContain('ЧДД — [указать ЧДД]');
    expect(t).toContain('По шкале Нортон: 9 баллов — высокий риск пролежней');
    expect(t).toContain('Телефон службы.');
  });
});
