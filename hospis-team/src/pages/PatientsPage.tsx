import { useMemo, useState } from 'react';
import type { IsoDate, Patient } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { cn } from '../lib/cn.ts';
import { daysBetween, formatDayShort } from '../lib/dates.ts';
import { matches } from '../lib/patients.ts';
import { nextVisitDate } from '../lib/schedule.ts';
import { PlusIcon, SearchIcon } from '../components/icons.tsx';
import { PatientRow } from '../components/PatientRow.tsx';

type Filter = 'all' | 'cath' | 'hospital' | 'archive';

const byName = (a: Patient, b: Patient) => a.fullName.localeCompare(b.fullName, 'ru');

const whenLabel = (patient: Patient, today: IsoDate): string => {
  if (patient.archived) return 'архив';
  if (patient.hospital) return 'больница';
  const next = nextVisitDate(patient.schedule, today);
  if (!next) return '—';
  const diff = daysBetween(today, next);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  return formatDayShort(next);
};

export const PatientsPage = ({ today, onOpenPatient, onAddPatient }: { today: IsoDate; onOpenPatient: (id: string) => void; onAddPatient: () => void }) => {
  const { data } = useData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: data.patients.filter((p) => !p.archived).length,
      cath: data.patients.filter((p) => !p.archived && p.catheter.type !== 'none').length,
      hospital: data.patients.filter((p) => !p.archived && p.hospital).length,
      archive: data.patients.filter((p) => p.archived).length,
    }),
    [data.patients],
  );

  const list = data.patients
    .filter((p) => {
      if (filter === 'archive') return p.archived;
      if (p.archived) return false;
      if (filter === 'cath') return p.catheter.type !== 'none';
      if (filter === 'hospital') return Boolean(p.hospital);
      return true;
    })
    .filter((p) => matches(p, query))
    .sort(byName);

  const groups: Array<{ letter: string; items: Patient[] }> = [];
  for (const patient of list) {
    const letter = patient.fullName.charAt(0).toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.items.push(patient);
    else groups.push({ letter, items: [patient] });
  }

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: `Все ${counts.all}` },
    ...(counts.cath ? [{ id: 'cath' as const, label: `Катетер ${counts.cath}` }] : []),
    ...(counts.hospital ? [{ id: 'hospital' as const, label: `Больница ${counts.hospital}` }] : []),
    ...(counts.archive ? [{ id: 'archive' as const, label: `Архив ${counts.archive}` }] : []),
  ];

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="h1">Пациенты</h1>
        <button type="button" className="btn btn--primary btn--sm" onClick={onAddPatient}>
          <PlusIcon width={18} height={18} />
          Добавить
        </button>
      </header>

      <label className="search">
        <SearchIcon className="search__icon" width={20} height={20} />
        <input
          className="input"
          type="search"
          value={query}
          placeholder="Фамилия, полис, телефон, адрес"
          aria-label="Поиск"
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {chips.length > 1 && (
        <div className="chips" role="tablist" aria-label="Фильтр">
          {chips.map((chip) => (
            <button key={chip.id} type="button" role="tab" aria-selected={filter === chip.id} className={cn('chip', filter === chip.id && 'chip--on')} onClick={() => setFilter(chip.id)}>
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="empty-line">{query ? 'Никого не нашлось' : 'Список пуст'}</p>
      ) : (
        groups.map((group) => (
          <section key={group.letter} className="letter-block">
            <h2 className="letter-block__title">{group.letter}</h2>
            <div className="group">
              {group.items.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  today={today}
                  open={openId === patient.id}
                  onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
                  onOpen={onOpenPatient}
                  tone={patient.archived || patient.hospital ? 'muted' : 'default'}
                  aside={<span className={cn('when', whenLabel(patient, today) === 'сегодня' && 'when--today')}>{whenLabel(patient, today)}</span>}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
};
