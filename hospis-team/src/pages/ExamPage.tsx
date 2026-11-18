import { useMemo, useState, type ReactNode } from 'react';
import type { IsoDate } from '../types.ts';
import { SERVICE_CONTACTS } from '../config.ts';
import { useData } from '../hooks/useData.tsx';
import { copyText } from '../lib/clipboard.ts';
import { cn } from '../lib/cn.ts';
import { MORSE, NORTON, OPTIONS, examFor, examText, morseRisk, morseScore, nortonRisk, nortonScore, type Exam } from '../lib/exam.ts';
import { shortName } from '../lib/format.ts';
import { haptic } from '../lib/telegram.ts';
import { ChevronLeft } from '../components/icons.tsx';

const KEY = (id: string) => `hospis_exam_${id}`;

const loadLast = (id: string): Partial<Exam> | null => {
  try {
    const text = window.localStorage.getItem(KEY(id));
    return text ? (JSON.parse(text) as Partial<Exam>) : null;
  } catch {
    return null;
  }
};

const Block = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="card exam-block">
    <h2 className="card__title card__title--sm">{title}</h2>
    {children}
  </section>
);

/** Один вариант из списка + «своё» текстом. */
const Pick = ({ label, options, value, onChange, custom = true }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; custom?: boolean }) => {
  const own = value !== '' && !options.includes(value);
  return (
    <div className="exam-field">
      <p className="field__label">{label}</p>
      <div className="chips chips--wrap">
        {options.map((o) => (
          <button key={o} type="button" className={cn('chip chip--sm', value === o && 'chip--on')} onClick={() => onChange(value === o ? '' : o)}>
            {o}
          </button>
        ))}
      </div>
      {custom && <input className="input input--sm" value={own ? value : ''} placeholder="Или своё" aria-label={`${label}: своё`} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
};

const Field = ({ label, value, onChange, unit, mode = 'decimal' }: { label: string; value: string; onChange: (v: string) => void; unit?: string; mode?: 'decimal' | 'text' }) => (
  <label className="wnum">
    <span>
      {label}
      {unit ? `, ${unit}` : ''}
    </span>
    <input className="input input--center" inputMode={mode} value={value} onChange={(e) => onChange(e.target.value)} />
  </label>
);

const Toggle = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button type="button" className={cn('exam-toggle', checked && 'exam-toggle--on')} aria-pressed={checked} onClick={() => onChange(!checked)}>
    <span className="exam-toggle__box" aria-hidden="true">
      {checked ? '✓' : ''}
    </span>
    <span className="line__text">
      <span>{label}</span>
      {hint && <span className="line__sub">{hint}</span>}
    </span>
  </button>
);

/** Конструктор осмотра медсестры: варианты нажатием → текст по шаблону отделения. */
export const ExamPage = ({ patientId, today, onBack }: { patientId: string; today: IsoDate; onBack: () => void }) => {
  const { data } = useData();
  const patient = data.patients.find((p) => p.id === patientId);
  const [e, setE] = useState<Exam | null>(() => (patient ? examFor(patient, loadLast(patient.id)) : null));
  const [note, setNote] = useState('');
  const text = useMemo(() => (e ? examText(e, SERVICE_CONTACTS) : ''), [e]);

  if (!patient || !e) {
    return (
      <main className="page page--detail">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft width={20} height={20} />
          Назад
        </button>
        <p className="empty-line">Пациент не найден</p>
      </main>
    );
  }

  const set = <K extends keyof Exam>(key: K, value: Exam[K]) => setE((cur) => (cur ? { ...cur, [key]: value } : cur));
  const n = nortonScore(e.norton);
  const m = morseScore(e.morse);
  const missing = (text.match(/\[указать/g) ?? []).length;

  const copy = async () => {
    const ok = await copyText(text);
    try {
      window.localStorage.setItem(KEY(patient.id), JSON.stringify(e));
    } catch {
      // нет доступа к памяти
    }
    haptic(ok ? 'success' : 'error');
    setNote(ok ? 'Скопировано. В следующий раз ответы подставятся сами — останется обновить показатели.' : 'Не получилось скопировать');
  };

  return (
    <main className="page page--detail">
      <div className="topbar">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft width={20} height={20} />
          Назад
        </button>
      </div>
      <header>
        <h1 className="h1">Осмотр</h1>
        <p className="hint">
          {shortName(patient.fullName)} · {today.split('-').reverse().join('.')}
        </p>
      </header>

      <Block title="Визит и уход">
        <Pick label="Визит в присутствии" options={OPTIONS.presence} value={e.presence} onChange={(v) => set('presence', v)} />
        <Pick label="Уход осуществляет" options={OPTIONS.carer} value={e.carer} onChange={(v) => set('carer', v)} />
        <Pick label="Активность" options={OPTIONS.activity} value={e.activity} onChange={(v) => set('activity', v)} />
        <Pick label="Лежит на" options={OPTIONS.bed} value={e.bed} onChange={(v) => set('bed', v)} />
        <Pick label="Требуется" options={OPTIONS.care} value={e.care} onChange={(v) => set('care', v)} custom={false} />
        <Pick label="Посторонняя помощь" options={OPTIONS.help} value={e.help} onChange={(v) => set('help', v)} custom={false} />
        <Pick label="Аллергоанамнез" options={OPTIONS.allergy} value={e.allergy} onChange={(v) => set('allergy', v)} />
      </Block>

      <Block title="Показатели">
        <div className="wnums">
          <Field label="ЧСС" unit="уд/мин" value={e.hr} onChange={(v) => set('hr', v)} />
          <Field label="ЧДД" unit="в мин" value={e.rr} onChange={(v) => set('rr', v)} />
          <Field label="SpO₂" unit="%" value={e.spo2} onChange={(v) => set('spo2', v)} />
          <Field label="АД" value={e.bp} mode="text" onChange={(v) => set('bp', v)} />
          <Field label="Темп." unit="°C" value={e.temp} onChange={(v) => set('temp', v)} />
        </div>
        <Pick label="Одышка" options={OPTIONS.yesNo} value={e.dyspnea} onChange={(v) => set('dyspnea', v)} />
        <Pick label="Кашель" options={OPTIONS.yesNo} value={e.cough} onChange={(v) => set('cough', v)} />
      </Block>

      <Block title="Осмотр по системам">
        <Pick label="Аппетит" options={OPTIONS.appetite} value={e.appetite} onChange={(v) => set('appetite', v)} />
        <Pick label="Видимые слизистые" options={OPTIONS.mucosa} value={e.mucosa} onChange={(v) => set('mucosa', v)} />
        <Pick label="Костно-мышечная система" options={OPTIONS.musculo} value={e.musculo} onChange={(v) => set('musculo', v)} />
        <Pick label="Кожные покровы" options={OPTIONS.skin} value={e.skin} onChange={(v) => set('skin', v)} />
        <Pick label="Отёки" options={OPTIONS.yesNo} value={e.edema} onChange={(v) => set('edema', v)} custom={false} />
        {e.edema === 'есть' && <input className="input input--sm" value={e.edemaWhere} placeholder="Где: нижние конечности…" aria-label="Где отёки" onChange={(ev) => set('edemaWhere', ev.target.value)} />}
        <Pick label="Тургор" options={OPTIONS.turgor} value={e.turgor} onChange={(v) => set('turgor', v)} custom={false} />
        <Toggle label="Есть пролежни, трофические изменения" checked={e.ulcers} onChange={(v) => set('ulcers', v)} />
        <Pick label="Мочеиспускание" options={OPTIONS.urination} value={e.urination} onChange={(v) => set('urination', v)} />
        <Pick label="Цвет мочи" options={OPTIONS.urineColor} value={e.urineColor} onChange={(v) => set('urineColor', v)} />
        <Pick label="Живот" options={OPTIONS.abdomen} value={e.abdomen} onChange={(v) => set('abdomen', v)} />
        <Pick label="Стул" options={OPTIONS.stool} value={e.stool} onChange={(v) => set('stool', v)} />
        <label className="wnum">
          <span>Дата последней дефекации</span>
          <input className="input" type="date" value={e.lastStool} max={today} onChange={(ev) => set('lastStool', ev.target.value)} />
        </label>
        <Pick label="Контакт" options={OPTIONS.contact} value={e.contact} onChange={(v) => set('contact', v)} custom={false} />
        <Pick label="Сознание" options={OPTIONS.consciousness} value={e.consciousness} onChange={(v) => set('consciousness', v)} custom={false} />
      </Block>

      <Block title="Status localis и ситуация">
        <Toggle label="Отказ от перевязки" hint="Вставит абзац о беседе и предупреждении о рисках" checked={e.refusedDressing} onChange={(v) => set('refusedDressing', v)} />
        {!e.refusedDressing && (
          <textarea className="input textarea" rows={3} value={e.localis} placeholder="Status localis — можно собрать кнопкой «Status localis» в карточке" aria-label="Status localis" onChange={(ev) => set('localis', ev.target.value)} />
        )}
        <Toggle label="Просит госпитализацию в хоспис" hint="Информация передана заведующей, поставлен в план" checked={e.wantsHospice} onChange={(v) => set('wantsHospice', v)} />
        <Toggle label="Санитарные условия неудовлетворительные" hint="Вставит описание и запись о беседе" checked={e.badHygiene} onChange={(v) => set('badHygiene', v)} />
        <textarea className="input textarea" rows={2} value={e.extra} placeholder="Дополнительно: что сделано, рекомендации" aria-label="Дополнительно" onChange={(ev) => set('extra', ev.target.value)} />
      </Block>

      <Block title="Шкалы">
        <Pick label="PPS, %" options={OPTIONS.pps} value={e.pps} onChange={(v) => set('pps', v)} custom={false} />
        <p className="field__label">Нортон {n !== null && <b className="score">{n} — {nortonRisk(n)}</b>}</p>
        {NORTON.map((item, k) => (
          <div key={item.name} className="exam-field">
            <p className="line__sub">{item.name}</p>
            <div className="chips chips--wrap">
              {item.options.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  className={cn('chip chip--sm', e.norton[k] === i && 'chip--on')}
                  onClick={() => set('norton', e.norton.map((x, j) => (j === k ? (x === i ? -1 : i) : x)))}
                >
                  {o} · {4 - i}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="field__label">Морсе {m !== null && <b className="score">{m} — {morseRisk(m)}</b>}</p>
        {MORSE.map((item, k) => (
          <div key={item.name} className="exam-field">
            <p className="line__sub">{item.name}</p>
            <div className="chips chips--wrap">
              {item.options.map(([o, pts], i) => (
                <button
                  key={o}
                  type="button"
                  className={cn('chip chip--sm', e.morse[k] === i && 'chip--on')}
                  onClick={() => set('morse', e.morse.map((x, j) => (j === k ? (x === i ? -1 : i) : x)))}
                >
                  {o} · {pts}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="hint">Пороги риска по Морсе в разных учреждениях отличаются — сверьте с принятыми у вас.</p>
      </Block>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--sm">Готовый текст</h2>
          {missing > 0 && <span className="card__meta card__meta--alert">не заполнено: {missing}</span>}
        </div>
        <div className="wtext">{text}</div>
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => void copy()}>
          Скопировать для карты
        </button>
        {note && <p className="hint hint--center">{note}</p>}
      </section>
    </main>
  );
};
