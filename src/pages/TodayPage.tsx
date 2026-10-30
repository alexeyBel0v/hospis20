import { useMemo, useState } from 'react';
import type { IsoDate, Patient } from '../types.ts';
import { useContent } from '../hooks/useContent.ts';
import { useData } from '../hooks/useData.tsx';
import { addDays, formatDayMonth, formatRelative, formatWeekday, formatWeekdayShort, formatDayShort } from '../lib/dates.ts';
import { createDemoData } from '../lib/demo.ts';
import { cn } from '../lib/cn.ts';
import { patientsOn } from '../lib/schedule.ts';
import { hasShifts, isWorkDay, nextWorkDay } from '../lib/shifts.ts';
import { GearIcon, PlusIcon, RouteIcon, ChevronRight } from '../components/icons.tsx';
import { PatientRow } from '../components/PatientRow.tsx';
import { RouteSheet } from '../components/RouteSheet.tsx';
import { Segmented } from '../components/ui.tsx';

type Props = {
  today: IsoDate;
  onOpenPatient: (id: string) => void;
  onAddPatient: () => void;
  onOpenSettings: () => void;
  onOpenNews: () => void;
  onOpenSchedule: () => void;
};

type View = 'today' | 'tomorrow' | 'week';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const TodayPage = ({ today, onOpenPatient, onAddPatient, onOpenSettings, onOpenNews, onOpenSchedule }: Props) => {
  const { data, replaceAll } = useData();
  const { news } = useContent();
  const [view, setView] = useState<View>('today');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);

  const tomorrow = addDays(today, 1);
  const todayList = useMemo(() => patientsOn(data.patients, today), [data.patients, today]);
  const tomorrowList = useMemo(() => patientsOn(data.patients, tomorrow), [data.patients, tomorrow]);
  const week = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => addDays(today, i + 2))
        .map((date) => ({ date, patients: patientsOn(data.patients, date) }))
        .filter((day) => day.patients.length > 0),
    [data.patients, today],
  );
  const weekCount = week.reduce((sum, day) => sum + day.patients.length, 0);
  const inHospital = data.patients.filter((p) => !p.archived && p.hospital).length;

  const unread = news.filter((item) => !data.settings.seenNews.includes(item.id));
  const pinned = unread[0] ?? news.find((item) => item.important);

  const { shifts } = data;
  const shiftsSet = hasShifts(shifts);
  const working = isWorkDay(shifts, today);
  const nextShift = working ? null : nextWorkDay(shifts, tomorrow);

  const rows = (patients: Patient[], keyPrefix: string) => (
    <div className="group">
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
          />
        );
      })}
    </div>
  );

  const hasPatients = data.patients.some((p) => !p.archived);

  return (
    <main className="page">
      <header className="today-head">
        <div>
          <p className="today-head__weekday">{capitalize(formatWeekday(today))}</p>
          <h1 className="today-head__date">{formatDayMonth(today)}</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="Настройки" onClick={onOpenSettings}>
          <GearIcon />
        </button>
      </header>

      <button type="button" className={cn('shift', working && 'shift--work')} onClick={onOpenSchedule}>
        <span className="shift__dot" aria-hidden="true" />
        <span className="shift__text">
          {!shiftsSet
            ? 'Отметить свои смены'
            : working
              ? `Смена сегодня${shifts.hours ? `, ${shifts.hours}` : ''}`
              : nextShift
                ? `Выходной. Смена ${nextShift === tomorrow ? 'завтра' : `${formatWeekdayShort(nextShift)}, ${formatDayShort(nextShift)}`}`
                : 'Выходной'}
        </span>
        <ChevronRight width={18} height={18} />
      </button>

      {pinned && (
        <button type="button" className={cn('news-pin', pinned.important && 'news-pin--important')} onClick={onOpenNews}>
          <span className="news-pin__label">{unread.length ? (unread.length > 1 ? `Новое, ${unread.length}` : 'Новое') : 'Важно'}</span>
          <span className="news-pin__title">{pinned.title}</span>
        </button>
      )}

      {!hasPatients ? (
        <section className="empty">
          <p className="empty__title">Пациентов пока нет</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onAddPatient}>
            <PlusIcon width={20} height={20} />
            Добавить пациента
          </button>
          {data.patients.length === 0 && (
            <button type="button" className="btn btn--soft btn--block" onClick={() => replaceAll(createDemoData(today))}>
              Посмотреть на примере
            </button>
          )}
        </section>
      ) : (
        <>
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

          {view === 'today' &&
            (todayList.length ? (
              <>
                {rows(todayList, 'today')}
                {todayList.some((p) => p.address) && (
                  <button type="button" className="btn btn--soft btn--block" onClick={() => setRouteOpen(true)}>
                    <RouteIcon width={20} height={20} />
                    Маршрут
                  </button>
                )}
              </>
            ) : (
              <p className="empty-line">Сегодня визитов нет</p>
            ))}

          {view === 'tomorrow' && (tomorrowList.length ? rows(tomorrowList, 'tomorrow') : <p className="empty-line">Завтра визитов нет</p>)}

          {view === 'week' &&
            (week.length ? (
              week.map((day) => (
                <section key={day.date} className="day-block">
                  <h2 className="day-block__title">
                    {capitalize(formatRelative(day.date, today))}
                    <span>{day.patients.length}</span>
                  </h2>
                  {rows(day.patients, day.date)}
                </section>
              ))
            ) : (
              <p className="empty-line">До конца недели визитов нет</p>
            ))}

          {inHospital > 0 && <p className="hint hint--center">В больнице: {inHospital}</p>}
        </>
      )}

      {routeOpen && <RouteSheet patients={todayList} onClose={() => setRouteOpen(false)} />}
    </main>
  );
};
