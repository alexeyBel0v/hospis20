import { describe, expect, it } from 'vitest';
import { emptyWound, woundFromAi, woundText, woundWarnings } from './wound.ts';

describe('status localis', () => {
  it('собирает текст и помечает пропущенное, ничего не выдумывая', () => {
    const w = { ...emptyWound(), stage: '3', location: 'крестца', length: 3, width: 6 };
    const t = woundText(w);
    expect(t).toContain('в области крестца пролежень 3 стадии (NPIAP) размерами 3,0×6,0 см');
    expect(t).toContain('[указать ткани дна в %]');
    expect(t).toContain('[указать края]');
  });

  it('предупреждает, если дно закрыто некрозом, но стадию не меняет', () => {
    const w = { ...emptyWound(), stage: '3', necrosis: 100 };
    expect(woundWarnings(w)[0]).toContain('неклассифицируемая');
    expect(woundText(w)).toContain('3 стадии');
  });

  it('отбрасывает выдуманные значения из ответа ИИ', () => {
    const w = woundFromAi({ stage: '5', edges: ['ровные', 'красивые'], exudateAmount: 'много', length: '3,5' });
    expect(w.stage).toBeNull();
    expect(w.edges).toEqual(['ровные']);
    expect(w.exudateAmount).toBeNull();
    expect(w.length).toBe(3.5);
  });
});
