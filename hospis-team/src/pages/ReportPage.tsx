import { useMemo, useState } from 'react';
import type { IsoDate } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { addDays, firstOfMonth, formatDayShort, isIsoDate } from '../lib/dates.ts';
import { downloadFile, toCsv } from '../lib/download.ts';
import { roleName, shortName } from '../lib/format.ts';
import { assigned, buildReport, missedTable, patientsTable, visitsTable, type Period } from '../lib/report.ts';
import { patientsOn } from '../lib/schedule.ts';
import { DownloadIcon } from '../components/icons.tsx';
import { Segmented } from '../components/ui.tsx';

type Range = 'week' | 'month' | 'custom';

/** Отчёт для заведующей и старшей сестры: визиты по сотрудникам, пропуски, выгрузка в Excel. */
export const ReportPage = ({ today, onOpenPatient }: { today: IsoDate; onOpenPatient: (id: string) => void }) => {
  const { data, users } = useData();
  const [range, setRange] = useState<Range>('week');
  const [custom, setCustom] = useState<Period>({ from: firstOfMonth(today), to: today });
  const [who, setWho] = useState('');

  const period: Period =
    range === 'week' ? { from: addDays(today, -6), to: today } : range === 'month' ? { from: firstOfMonth(today), to: today } : custom;
  const valid = isIsoDate(period.from) && isIsoDate(period.to) && period.from <= period.to;

  const report = useMemo(
    () => (valid ? buildReport(data.patients, data.visits, users, period, today, who || null) : null),
    [data.patients, data.visits, users, period.from, period.to, today, who, valid],
  );
  const field = users.filter((u) => u.role === 'doctor' || u.role === 'nurse');
  const suffix = `${period.from}_${period.to}`;
  const percent = report && report.planned ? Math.round((Math.min(report.done, report.planned) / report.planned) * 100) : 0;

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="h1">Отчёт</h1>
      </header>

      <Segmented<Range>
        label="Период"
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: '7 дней' },
          { value: 'month', label: 'Месяц' },
          { value: 'custom', label: 'Период' },
        ]}
      />
      {range === 'custom' && (
        <div className="grid-2">
          <input className="input" type="date" aria-label="С" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <input className="input" type="date" aria-label="По" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}

      <select className="input" aria-label="Сотрудник" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">Все сотрудники</option>
        {field.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {roleName(u.role).toLowerCase()}
          </option>
        ))}
      </select>

      {!report ? (
        <p className="field__error">Проверьте даты периода</p>
      ) : (
        <>
          <section className="stats">
            <div className="stat">
              <span className="stat__num">{report.done}</span>
              <span className="stat__label">визитов отмечено</span>
            </div>
            <div className="stat">
              <span className="stat__num">{report.planned}</span>
              <span className="stat__label">по графику</span>
            </div>
            <div className={report.missed.length ? 'stat stat--warn' : 'stat'}>
              <span className="stat__num">{report.missed.length}</span>
              <span className="stat__label">без отметки</span>
            </div>
            <div className="stat">
              <span className="stat__num">{report.patients}</span>
              <span className="stat__label">пациентов</span>
            </div>
          </section>
          <div className="progress">
            <div className="progress__bar">
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="progress__text">
              <b>{percent}%</b> визитов по графику отмечены
            </span>
          </div>

          <section className="block">
            <h2 className="block__title">По сотрудникам</h2>
            <div className="group">
              {report.byStaff.map((line) => (
                <button key={line.user.id} type="button" className="line" onClick={() => setWho(who === line.user.id ? '' : line.user.id)}>
                  <span className="line__text">
                    <span>{shortName(line.user.name)}</span>
                    <span className="line__sub">
                      {roleName(line.user.role)} · пациентов {line.patients} · сегодня {line.today}
                    </span>
                  </span>
                  <span className="count-pill">{line.visits}</span>
                </button>
              ))}
            </div>
            <p className="hint">Число справа — визиты за период. Нажмите на сотрудника, чтобы увидеть только его.</p>
          </section>

          {who && (
            <section className="block">
              <h2 className="block__title">Сегодня едет к</h2>
              <div className="group">
                {patientsOn(assigned(data.patients, who), today).map((p) => (
                    <button key={p.id} type="button" className="line" onClick={() => onOpenPatient(p.id)}>
                      <span className="line__text">
                        <span>{shortName(p.fullName)}</span>
                        <span className="line__sub">{p.address || 'адрес не указан'}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          )}

          {report.missed.length > 0 && (
            <section className="block">
              <h2 className="block__title">Требуют внимания</h2>
              <div className="group">
                {report.missed.slice(0, 12).map(({ patient, date }) => (
                  <button key={`${patient.id}${date}`} type="button" className="line" onClick={() => onOpenPatient(patient.id)}>
                    <span className="line__text">
                      <span>{shortName(patient.fullName)}</span>
                      <span className="line__sub">Визит {formatDayShort(date)} не отмечен</span>
                    </span>
                  </button>
                ))}
              </div>
              {report.missed.length > 12 && <p className="hint">И ещё {report.missed.length - 12} — все в выгрузке</p>}
            </section>
          )}

          <section className="block">
            <h2 className="block__title">Выгрузить в Excel</h2>
            <div className="download-list">
              <button type="button" className="btn btn--soft btn--block" onClick={() => downloadFile(`vizity_${suffix}.csv`, toCsv(visitsTable(report, data.patients, users)))}>
                <DownloadIcon width={18} height={18} />
                Визиты за период
              </button>
              <button type="button" className="btn btn--soft btn--block" onClick={() => downloadFile(`bez-otmetki_${suffix}.csv`, toCsv(missedTable(report, users)))}>
                <DownloadIcon width={18} height={18} />
                Визиты без отметки
              </button>
              <button type="button" className="btn btn--soft btn--block" onClick={() => downloadFile(`pacienty_${today}.csv`, toCsv(patientsTable(assigned(data.patients, who || null), users)))}>
                <DownloadIcon width={18} height={18} />
                Список пациентов
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
};
