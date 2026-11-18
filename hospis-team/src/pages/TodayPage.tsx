import { useMemo, useState, type ReactNode } from 'react';
import type { IsoDate, Patient, Visit } from '../types.ts';
import { useContent } from '../hooks/useContent.ts';
import { useData } from '../hooks/useData.tsx';
import { addDays, formatDayMonth, formatDayShort, formatRelative, formatWeekday, formatWeekdayShort, pluralRu } from '../lib/dates.ts';
import { cn } from '../lib/cn.ts';
import { patientsOn } from '../lib/schedule.ts';
import { hasShifts, isWorkDay, nextWorkDay } from '../lib/shifts.ts';
import { ChevronRight, PlusIcon, RouteIcon } from '../components/icons.tsx';
import { PatientRow } from '../components/PatientRow.tsx';
import { RouteSheet } from '../components/RouteSheet.tsx';
import { Segmented } from '../components/ui.tsx';

export type QuickTarget = 'patients' | 'schedule' | 'report' | 'news' | 'info';

type Props = {
  today: IsoDate;
  onOpenPatient: (id: string) => void;
  onAddPatient: () => void;
  onOpenSettings: () => void;
  onOpenSchedule: () => void;
  onQuick: (target: QuickTarget) => void;
};

type View = 'today' | 'tomorrow' | 'week';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('');

/* ---------- Иконки плиток: двухцветные, как в iOS ---------- */

const Tile = ({ id, children }: { id: string; children: ReactNode }) => (
  <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--tile-a)" />
        <stop offset="1" stopColor="var(--tile-b)" />
      </linearGradient>
    </defs>
    {children}
  </svg>
);

const PeopleTile = () => (
  <Tile id="t-people">
    <circle cx="13" cy="11" r="5.5" fill="url(#t-people)" />
    <path d="M3 27c0-5.5 4.5-9 10-9s10 3.5 10 9v1H3z" fill="url(#t-people)" />
    <circle cx="24" cy="12.5" r="4.2" fill="url(#t-people)" opacity=".55" />
    <path d="M22 18.6c5 .2 9 3 9 8V28h-6c0-3.9-1.2-7-3-9.4z" fill="url(#t-people)" opacity=".55" />
  </Tile>
);

const CalendarTile = () => (
  <Tile id="t-cal">
    <rect x="3" y="6" width="28" height="25" rx="6" fill="url(#t-cal)" />
    <rect x="3" y="6" width="28" height="7" rx="3" fill="#fff" opacity=".25" />
    <rect x="9" y="3" width="3" height="7" rx="1.5" fill="url(#t-cal)" />
    <rect x="22" y="3" width="3" height="7" rx="1.5" fill="url(#t-cal)" />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={8 + c * 5} y={16 + r * 4.5} width="3" height="3" rx="1" fill="#fff" opacity={r === 1 && c === 2 ? 1 : 0.75} />),
    )}
  </Tile>
);

const ChartTile = () => (
  <Tile id="t-chart">
    <rect x="4" y="16" width="6" height="14" rx="2" fill="url(#t-chart)" opacity=".6" />
    <rect x="14" y="9" width="6" height="21" rx="2" fill="url(#t-chart)" />
    <rect x="24" y="4" width="6" height="26" rx="2" fill="url(#t-chart)" opacity=".8" />
  </Tile>
);

const NewsTile = () => (
  <Tile id="t-news">
    <rect x="3" y="5" width="25" height="25" rx="5" fill="url(#t-news)" />
    <rect x="25" y="11" width="6" height="19" rx="3" fill="url(#t-news)" opacity=".6" />
    <rect x="7" y="10" width="8" height="7" rx="1.5" fill="#fff" />
    <rect x="17" y="10" width="7" height="2" rx="1" fill="#fff" opacity=".85" />
    <rect x="17" y="15" width="7" height="2" rx="1" fill="#fff" opacity=".85" />
    <rect x="7" y="21" width="17" height="2" rx="1" fill="#fff" opacity=".85" />
    <rect x="7" y="25" width="12" height="2" rx="1" fill="#fff" opacity=".85" />
  </Tile>
);

const BookTile = () => (
  <Tile id="t-book">
    <path d="M4 7c4-2 8-2 12 0v22c-4-2-8-2-12 0z" fill="url(#t-book)" />
    <path d="M18 7c4-2 8-2 12 0v22c-4-2-8-2-12 0z" fill="url(#t-book)" opacity=".65" />
    <path d="M23 13v6m-3-3h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
  </Tile>
);

/* ---------- Мини-график по последним 7 дням ---------- */

const Spark = ({ values, id }: { values: number[]; id: string }) => {
  const max = Math.max(1, ...values);
  const w = 120;
  const h = 44;
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 4 - (v / max) * (h - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** За каждый из последних 7 дней: сколько визитов было по графику и сколько отмечено. */
const lastWeek = (patients: Patient[], visits: Visit[], today: IsoDate) =>
  Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => {
    const planned = patientsOn(patients, date);
    const ids = new Set(visits.filter((v) => v.date === date).map((v) => v.patientId));
    return { planned: planned.length, done: planned.filter((p) => ids.has(p.id)).length };
  });

export const TodayPage = ({ today, onOpenPatient, onAddPatient, onOpenSettings, onOpenSchedule, onQuick }: Props) => {
  const { data, me, users, isManager } = useData();
  const { news } = useContent();
  const [who, setWho] = useState<string>('all');
  const [view, setView] = useState<View>('today');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);

  const tomorrow = addDays(today, 1);
  // Заведующая и старшая сестра видят всех; можно выбрать сотрудника — «кто куда едет».
  const mine = useMemo(
    () => (isManager && who !== 'all' ? data.patients.filter((p) => p.doctorId === who || p.nurseId === who) : data.patients),
    [data.patients, isManager, who],
  );
  const todayList = useMemo(() => patientsOn(mine, today), [mine, today]);
  const tomorrowList = useMemo(() => patientsOn(mine, tomorrow), [mine, tomorrow]);
  const visitedToday = new Set(data.visits.filter((v) => v.date === today).map((v) => v.patientId));
  const doneCount = todayList.filter((p) => visitedToday.has(p.id)).length;
  const field = users.filter((u) => u.role === 'doctor' || u.role === 'nurse');
  const week = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => addDays(today, i + 2))
        .map((date) => ({ date, patients: patientsOn(mine, date) }))
        .filter((day) => day.patients.length > 0),
    [mine, today],
  );
  const weekCount = week.reduce((sum, day) => sum + day.patients.length, 0);
  const inHospital = mine.filter((p) => !p.archived && p.hospital).length;
  const active = mine.filter((p) => !p.archived).length;
  const trend = useMemo(() => lastWeek(mine, data.visits, today), [mine, data.visits, today]);
  const weekVisits = trend.reduce((s, d) => s + d.done, 0);
  const weekPlanned = trend.reduce((s, d) => s + d.planned, 0);
  const percent = weekPlanned ? Math.round((weekVisits / weekPlanned) * 100) : 0;
  const latest = news[0];

  const { shifts } = data;
  const shiftsSet = hasShifts(shifts);
  const working = isWorkDay(shifts, today);
  const nextShift = working ? null : nextWorkDay(shifts, tomorrow);
  const shiftText = !shiftsSet
    ? 'Отметить свои смены'
    : working
      ? `Смена сегодня${shifts.hours ? `, ${shifts.hours}` : ''}`
      : nextShift
        ? `Выходной, смена ${nextShift === tomorrow ? 'завтра' : `${formatWeekdayShort(nextShift)}, ${formatDayShort(nextShift)}`}`
        : 'Выходной';

  const rows = (patients: Patient[], keyPrefix: string, visitDate?: IsoDate) => (
    <div className={cn('plan', visitDate && 'plan--today')}>
      {patients.map((patient) => {
        const key = `${keyPrefix}:${patient.id}`;
        return (
          <PatientRow
            key={key}
            patient={patient}
            today={today}
            open={openKey === key}
            onToggle={() => setOpenKey((current) => (current === key ? null : key))}
            onOpen={onOpenPatient}
            visitDate={visitDate}
            done={Boolean(visitDate && visitedToday.has(patient.id))}
          />
        );
      })}
    </div>
  );

  const hasPatients = data.patients.some((p) => !p.archived);
  const firstName = me.name.split(' ')[1] ?? me.name;

  return (
    <main className="page page--home">
      <header className="home-head">
        <div className="app-badge" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30">
            <path d="M15 26S3 19 3 10.5A6 6 0 0 1 15 8a6 6 0 0 1 12 2.5C27 19 15 26 15 26z" fill="#fff" />
            <path d="M15 11v8m-4-4h8" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="home-head__text">
          <p className="home-head__title">Hospis OS</p>
          <p className="home-head__sub">
            {capitalize(formatWeekday(today))}, {formatDayMonth(today)}
          </p>
        </div>
        <button type="button" className="me-btn" aria-label="Настройки и выход" onClick={onOpenSettings}>
          {initials(me.name)}
          <span className="me-btn__dot" aria-hidden="true" />
        </button>
      </header>

      <section className="hero">
        <div className="hero__body">
          <h1 className="hero__title">Здравствуйте, {firstName}</h1>
          <p className="hero__text">
            {todayList.length
              ? `Сегодня ${todayList.length} ${pluralRu(todayList.length, "визит", "визита", "визитов")}, отмечено ${doneCount}`
              : 'Сегодня визитов по графику нет'}
          </p>
          <div className="hero__actions">
            {todayList.some((p) => p.address) && (
              <button type="button" className="hero__btn" onClick={() => setRouteOpen(true)}>
                <RouteIcon width={18} height={18} />
                Маршрут
              </button>
            )}
            {!isManager && (
              <button type="button" className={cn('hero__chip', working && 'hero__chip--on')} onClick={onOpenSchedule}>
                {shiftText}
              </button>
            )}
          </div>
        </div>
      </section>

      <nav className="tiles" aria-label="Разделы">
        <button type="button" className="tile tile--blue" onClick={() => onQuick('patients')}>
          <PeopleTile />
          Пациенты
        </button>
        {isManager ? (
          <button type="button" className="tile tile--violet" onClick={() => onQuick('report')}>
            <ChartTile />
            Отчёт
          </button>
        ) : (
          <button type="button" className="tile tile--violet" onClick={() => onQuick('schedule')}>
            <CalendarTile />
            График
          </button>
        )}
        <button type="button" className="tile tile--cyan" onClick={() => onQuick('news')}>
          <NewsTile />
          Новости
        </button>
        <button type="button" className="tile tile--mint" onClick={() => onQuick('info')}>
          <BookTile />
          Справка
        </button>
      </nav>

      {isManager && field.length > 0 && (
        <div className="chips chips--scroll" role="group" aria-label="Сотрудник">
          <button type="button" className={cn('chip', who === 'all' && 'chip--on')} onClick={() => setWho('all')}>
            Все
          </button>
          {field.map((u) => (
            <button key={u.id} type="button" className={cn('chip', who === u.id && 'chip--on')} onClick={() => setWho(u.id)}>
              {u.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {!hasPatients ? (
        <section className="card empty">
          <p className="empty__title">Пациентов пока нет</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onAddPatient}>
            <PlusIcon width={20} height={20} />
            Добавить пациента
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">План</h2>
              <span className="card__meta">
                {view === 'today' && todayList.length > 0 ? `${doneCount} из ${todayList.length}` : ''}
              </span>
            </div>
            <Segmented<View>
              label="День"
              value={view}
              onChange={(v) => {
                setView(v);
                setOpenKey(null);
              }}
              options={[
                { value: 'today', label: <>Сегодня <b className="seg__count">{todayList.length}</b></> },
                { value: 'tomorrow', label: <>Завтра <b className="seg__count">{tomorrowList.length}</b></> },
                { value: 'week', label: <>Неделя <b className="seg__count">{weekCount}</b></> },
              ]}
            />

            {view === 'today' && (todayList.length ? rows(todayList, 'today', today) : <p className="empty-line">Сегодня визитов нет</p>)}

            {view === 'tomorrow' && (tomorrowList.length ? rows(tomorrowList, 'tomorrow') : <p className="empty-line">Завтра визитов нет</p>)}

            {view === 'week' &&
              (week.length ? (
                week.map((day) => (
                  <section key={day.date} className="day-block">
                    <h3 className="day-block__title">
                      {capitalize(formatRelative(day.date, today))}
                      <span>{day.patients.length}</span>
                    </h3>
                    {rows(day.patients, day.date)}
                  </section>
                ))
              ) : (
                <p className="empty-line">До конца недели визитов нет</p>
              ))}

            {inHospital > 0 && <p className="hint">В больнице: {inHospital}</p>}
          </section>

          <section className="stats-row">
            <button type="button" className="kpi kpi--mint" onClick={() => onQuick('patients')}>
              <Spark values={trend.map((d) => d.planned)} id="sp-a" />
              <span className="kpi__num">{active}</span>
              <span className="kpi__label">{pluralRu(active, 'пациент', 'пациента', 'пациентов')} под наблюдением</span>
            </button>
            <div className="kpi kpi--violet">
              <Spark values={trend.map((d) => (d.planned ? d.done / d.planned : 0))} id="sp-b" />
              <span className="kpi__num">{weekPlanned ? `${percent}%` : '—'}</span>
              <span className="kpi__label">визитов отмечено за 7 дней</span>
            </div>
          </section>
        </>
      )}

      {latest && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Новости</h2>
            <button type="button" className="card__link" onClick={() => onQuick('news')}>
              Все
              <ChevronRight width={16} height={16} />
            </button>
          </div>
          <button type="button" className="news-mini" onClick={() => onQuick('news')}>
            <span className="news-mini__img" aria-hidden="true" />
            <span className="news-mini__text">
              <b>{latest.title}</b>
              {latest.date && <span>{formatDayMonth(latest.date)}</span>}
            </span>
          </button>
        </section>
      )}

      {routeOpen && <RouteSheet patients={todayList} onClose={() => setRouteOpen(false)} />}
    </main>
  );
};
