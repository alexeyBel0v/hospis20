import { useMemo, useState } from 'react';
import type { IsoDate, Shifts } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { cn } from '../lib/cn.ts';
import { addDays, addMonths, daysInMonth, firstOfMonth, formatDayMonth, formatMonthYear, formatWeekday, isIsoDate, weekdayIndex } from '../lib/dates.ts';
import { patientsOn } from '../lib/schedule.ts';
import { EMPTY_SHIFTS, isWorkDay, presetOf, SHIFT_PRESETS, toggleDay } from '../lib/shifts.ts';
import { haptic } from '../lib/telegram.ts';
import { ChevronLeft, ChevronRight, GearIcon } from '../components/icons.tsx';
import { PatientRow } from '../components/PatientRow.tsx';
import { Field, Sheet } from '../components/ui.tsx';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ShiftSetup = ({ shifts, today, onSave, onClose }: { shifts: Shifts; today: IsoDate; onSave: (s: Shifts) => void; onClose: () => void }) => {
  const [work, setWork] = useState(shifts.work || 1);
  const [off, setOff] = useState(shifts.work ? shifts.off : 3);
  const [start, setStart] = useState(shifts.start || today);
  const [hours, setHours] = useState(shifts.hours || '08:00–20:00');
  const active = presetOf({ ...shifts, work, off });
  return (
    <Sheet title="Мой график смен" onClose={onClose}>
      <div className="chips chips--wrap">
        {SHIFT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cn('chip', active?.id === preset.id && 'chip--on')}
            onClick={() => {
              setWork(preset.work);
              setOff(preset.off);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <Field label="Работаю, дней" htmlFor="work">
          <input id="work" className="input input--center" inputMode="numeric" value={work} onChange={(e) => setWork(Math.min(14, Number(e.target.value.replace(/\D/g, '')) || 0))} />
        </Field>
        <Field label="Отдыхаю, дней" htmlFor="off">
          <input id="off" className="input input--center" inputMode="numeric" value={off} onChange={(e) => setOff(Math.min(14, Number(e.target.value.replace(/\D/g, '')) || 0))} />
        </Field>
      </div>
      <Field label="Одна из рабочих смен" htmlFor="shift-start" hint="Любая дата, когда вы работаете — от неё считается график">
        <input id="shift-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Часы" htmlFor="hours">
        <input id="hours" className="input" value={hours} placeholder="08:00–20:00" onChange={(e) => setHours(e.target.value)} />
      </Field>
      <button
        type="button"
        className="btn btn--primary btn--lg btn--block"
        disabled={!work || !isIsoDate(start)}
        onClick={() => {
          onSave({ work, off, start, hours: hours.trim(), overrides: {} });
          onClose();
        }}
      >
        Сохранить график
      </button>
      {shifts.work > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            onSave({ ...EMPTY_SHIFTS, overrides: {} });
            onClose();
          }}
        >
          Убрать график
        </button>
      )}
    </Sheet>
  );
};

export const SchedulePage = ({ today, onOpenPatient }: { today: IsoDate; onOpenPatient: (id: string) => void }) => {
  const { data, update } = useData();
  const [month, setMonth] = useState(firstOfMonth(today));
  const [selected, setSelected] = useState(today);
  const [setupOpen, setSetupOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { shifts } = data;

  const cells = useMemo(() => {
    const lead = weekdayIndex(month);
    const total = daysInMonth(month);
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: total }, (_, i) => addDays(month, i))];
  }, [month]);

  const counts = useMemo(() => new Map(cells.filter((d): d is IsoDate => d !== null).map((d) => [d, patientsOn(data.patients, d).length])), [cells, data.patients]);
  const dayPatients = patientsOn(data.patients, selected);
  const workSelected = isWorkDay(shifts, selected);
  const shiftCount = cells.filter((d) => d && isWorkDay(shifts, d)).length;

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="h1">График</h1>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => setSetupOpen(true)}>
          <GearIcon width={18} height={18} />
          Смены
        </button>
      </header>

      <section className="cal">
        <div className="cal__head">
          <button type="button" className="icon-btn icon-btn--ghost" aria-label="Прошлый месяц" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </button>
          <span className="cal__month">
            {formatMonthYear(month)}
            {shiftCount > 0 && <small>смен: {shiftCount}</small>}
          </span>
          <button type="button" className="icon-btn icon-btn--ghost" aria-label="Следующий месяц" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight />
          </button>
        </div>
        <div className="cal__grid">
          {WEEK.map((w) => (
            <span key={w} className="cal__wd">
              {w}
            </span>
          ))}
          {cells.map((date, i) =>
            date ? (
              <button
                key={date}
                type="button"
                className={cn('cal__day', isWorkDay(shifts, date) && 'cal__day--work', date === today && 'cal__day--today', date === selected && 'cal__day--selected')}
                aria-pressed={isWorkDay(shifts, date)}
                onClick={() => {
                  haptic();
                  setSelected(date);
                  setOpenId(null);
                  update((d) => ({ ...d, shifts: toggleDay(d.shifts, date) }));
                }}
              >
                <span>{Number(date.slice(8))}</span>
                {(counts.get(date) ?? 0) > 0 && <small>{counts.get(date)}</small>}
              </button>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
        <p className="cal__legend">
          <span className="legend-swatch" /> смена — нажмите на дату, чтобы отметить или снять
        </p>
      </section>

      <section className="day-block">
        <h2 className="day-block__title">
          {capitalize(formatWeekday(selected))}, {formatDayMonth(selected)}
          <span>{workSelected ? 'смена' : 'выходной'}</span>
        </h2>
        {dayPatients.length ? (
          <div className="group">
            {dayPatients.map((p) => (
              <PatientRow key={p.id} patient={p} today={today} open={openId === p.id} onToggle={(id) => setOpenId((c) => (c === id ? null : id))} onOpen={onOpenPatient} />
            ))}
          </div>
        ) : (
          <p className="empty-line">Визитов нет</p>
        )}
      </section>

      {setupOpen && <ShiftSetup shifts={shifts} today={today} onSave={(s) => update((d) => ({ ...d, shifts: s }))} onClose={() => setSetupOpen(false)} />}
    </main>
  );
};
