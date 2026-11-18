import { useState } from 'react';
import type { IsoDate, Patient } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { ApiError, askAiWound } from '../lib/api.ts';
import { copyText } from '../lib/clipboard.ts';
import { cn } from '../lib/cn.ts';
import { formatDots } from '../lib/dates.ts';
import { haptic } from '../lib/telegram.ts';
import { EDGES, EXUDATE_AMOUNTS, EXUDATE_TYPES, SKIN, STAGES, emptyWound, woundFromAi, woundText, woundWarnings, type Wound } from '../lib/wound.ts';
import { Sheet } from './ui.tsx';

const Chips = ({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string | null) => void }) => (
  <div className="chips chips--wrap">
    {options.map((o) => (
      <button key={o} type="button" className={cn('chip chip--sm', value === o && 'chip--on')} onClick={() => onChange(value === o ? null : o)}>
        {o}
      </button>
    ))}
  </div>
);

const Multi = ({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
  <div className="chips chips--wrap">
    {options.map((o) => (
      <button key={o} type="button" className={cn('chip chip--sm', value.includes(o) && 'chip--on')} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>
        {o}
      </button>
    ))}
  </div>
);

const Num = ({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) => (
  <label className="wnum">
    <span>{label}</span>
    <input
      className="input input--center"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => {
        const n = Number(e.target.value.replace(',', '.'));
        onChange(e.target.value.trim() === '' || !Number.isFinite(n) ? null : n);
      }}
    />
  </label>
);

/** Status localis: коротко пишете — ИИ раскладывает по параметрам — приложение собирает текст по шаблону. */
export const WoundSheet = ({ patient, today, onClose }: { patient: Patient; today: IsoDate; onClose: () => void }) => {
  const { update } = useData();
  const [note, setNote] = useState('');
  const [w, setW] = useState<Wound>(emptyWound);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const set = <K extends keyof Wound>(key: K, value: Wound[K]) => setW((cur) => ({ ...cur, [key]: value }));
  const text = woundText(w);
  const warnings = woundWarnings(w);

  const parse = async () => {
    setBusy(true);
    setError('');
    try {
      const { wound } = await askAiWound(note);
      setW(woundFromAi(wound));
      haptic('success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ИИ не ответил — заполните параметры вручную');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const entry = `${formatDots(today)}: ${text}`;
    update((d) => ({
      ...d,
      patients: d.patients.map((p) => (p.id === patient.id ? { ...p, wounds: entry, updatedAt: new Date().toISOString() } : p)),
    }));
    haptic('success');
    setDone('Сохранено в карточку пациента, поле «Раны»');
  };

  return (
    <Sheet title="Status localis" onClose={onClose}>
      <p className="hint">Напишите коротко, как привыкли: «пролежень крестца 3 ст 3х6 глуб 1, грануляции 70 фибрин 30, отделяемое умеренное серозное, края ровные, вокруг гиперемия 1 см». ИИ разложит по пунктам, текст соберётся по шаблону.</p>
      <textarea className="input textarea" rows={3} value={note} placeholder="Коротко о ране" aria-label="Коротко о ране" onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn btn--soft btn--block" disabled={busy || !note.trim()} onClick={() => void parse()}>
        {busy ? 'ИИ разбирает…' : '✦ Разобрать с ИИ'}
      </button>
      {error && <p className="field__error">{error}</p>}

      <div className="wform">
        <p className="field__label">Стадия</p>
        <Chips options={STAGES} value={w.stage} onChange={(v) => set('stage', v)} />
        <label className="field__label" htmlFor="wloc">
          Локализация (в области…)
        </label>
        <input id="wloc" className="input" value={w.location} placeholder="крестца, левой пятки…" onChange={(e) => set('location', e.target.value)} />
        <div className="wnums">
          <Num label="Длина, см" value={w.length} onChange={(v) => set('length', v)} />
          <Num label="Ширина, см" value={w.width} onChange={(v) => set('width', v)} />
          <Num label="Глубина, см" value={w.depth} onChange={(v) => set('depth', v)} />
        </div>
        {w.stage !== '1' && (
          <>
            <p className="field__label">Дно раны, %</p>
            <div className="wnums">
              <Num label="Грануляции" value={w.granulation} onChange={(v) => set('granulation', v)} />
              <Num label="Фибрин" value={w.fibrin} onChange={(v) => set('fibrin', v)} />
              <Num label="Некроз" value={w.necrosis} onChange={(v) => set('necrosis', v)} />
            </div>
            <p className="field__label">Отделяемое</p>
            <Chips options={EXUDATE_AMOUNTS} value={w.exudateAmount} onChange={(v) => set('exudateAmount', v)} />
            {w.exudateAmount !== 'нет' && <Chips options={EXUDATE_TYPES} value={w.exudateType} onChange={(v) => set('exudateType', v)} />}
            <Chips options={['без запаха', 'с запахом']} value={w.odor === null ? null : w.odor ? 'с запахом' : 'без запаха'} onChange={(v) => set('odor', v === null ? null : v === 'с запахом')} />
            <p className="field__label">Края</p>
            <Multi options={EDGES} value={w.edges} onChange={(v) => set('edges', v)} />
          </>
        )}
        <p className="field__label">Кожа вокруг</p>
        <Multi options={SKIN} value={w.skin} onChange={(v) => set('skin', v)} />
        <div className="wnums">
          {w.skin.includes('гиперемия') && <Num label="Гиперемия, см" value={w.hyperemiaCm} onChange={(v) => set('hyperemiaCm', v)} />}
          <Num label="Боль, 0–10" value={w.pain} onChange={(v) => set('pain', v)} />
        </div>
      </div>

      {warnings.map((x) => (
        <p key={x} className="banner-note banner-note--warn">
          {x}
        </p>
      ))}

      <div className="wtext">{text}</div>
      <div className="grid-2">
        <button type="button" className="btn btn--soft" onClick={() => void copyText(text).then((ok) => setDone(ok ? 'Текст скопирован' : 'Не получилось скопировать'))}>
          Скопировать
        </button>
        <button type="button" className="btn btn--primary" onClick={save}>
          В карточку
        </button>
      </div>
      {done && <p className="hint hint--center">{done}</p>}
      <p className="hint">Пометки [указать …] — то, чего нет в записи. Заполните их или удалите после копирования.</p>
    </Sheet>
  );
};
