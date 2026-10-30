import { useState } from 'react';
import type { IsoDate, Patient } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { addressDetails, placeUrl } from '../lib/address.ts';
import { cn } from '../lib/cn.ts';
import { addDays, formatDayShort, formatDots, formatRelative, isIsoDate } from '../lib/dates.ts';
import { catheterLabel } from '../lib/format.ts';
import { discharge, removePatient, setArchived, setHospital } from '../lib/patients.ts';
import { scheduleLabel, upcomingVisits } from '../lib/schedule.ts';
import { callPhone, confirmAction, haptic, openLink } from '../lib/telegram.ts';
import { ChevronLeft, HospitalIcon, NavIcon, PencilIcon, PhoneIcon } from '../components/icons.tsx';
import { Sheet } from '../components/ui.tsx';

type Props = { patientId: string; today: IsoDate; onBack: () => void; onEdit: (id: string) => void };

const DateChoice = ({ today, value, onChange, past }: { today: IsoDate; value: IsoDate; onChange: (d: IsoDate) => void; past?: boolean }) => {
  const quick = past ? [0, -1, -2] : [0, 1, 2];
  const names = past ? ['Сегодня', 'Вчера', 'Позавчера'] : ['Сегодня', 'Завтра', 'Послезавтра'];
  return (
    <>
      <div className="chips chips--grid">
        {quick.map((shift, i) => {
          const date = addDays(today, shift);
          return (
            <button key={date} type="button" className={cn('chip chip--tall', value === date && 'chip--on')} onClick={() => onChange(date)}>
              {names[i]}
              <small>{formatDayShort(date)}</small>
            </button>
          );
        })}
      </div>
      <input className="input" type="date" value={value} aria-label="Другая дата" onChange={(e) => onChange(e.target.value)} />
    </>
  );
};

const HospitalSheet = ({ patient, today, onClose }: { patient: Patient; today: IsoDate; onClose: () => void }) => {
  const { update } = useData();
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const leaving = Boolean(patient.hospital);
  const save = () => {
    if (!isIsoDate(date)) return;
    update((data) => (leaving ? discharge(data, patient.id, date) : setHospital(data, patient.id, { since: date, note: note.trim() })));
    haptic('success');
    onClose();
  };
  return (
    <Sheet title={leaving ? 'Выписали' : 'В больнице'} onClose={onClose}>
      <p className="hint">{leaving ? 'С какого дня снова ездим' : 'Визиты встанут на паузу'}</p>
      <DateChoice today={today} value={date} onChange={setDate} past={!leaving} />
      {!leaving && <input className="input" value={note} placeholder="Куда положили" aria-label="Куда положили" onChange={(e) => setNote(e.target.value)} />}
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!isIsoDate(date)} onClick={save}>
        {leaving ? 'Вернуть в график' : 'Поставить на паузу'}
      </button>
    </Sheet>
  );
};

export const PatientPage = ({ patientId, today, onBack, onEdit }: Props) => {
  const { data, update } = useData();
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const patient = data.patients.find((p) => p.id === patientId);

  if (!patient) {
    return (
      <main className="page">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft width={20} height={20} />
          Назад
        </button>
        <p className="empty-line">Пациент удалён</p>
      </main>
    );
  }

  const details = addressDetails(patient);
  const upcoming = patient.hospital ? [] : upcomingVisits(patient.schedule, today, 6);
  const medical = [
    { label: 'Катетер', value: catheterLabel(patient), tone: 'cath' },
    { label: 'Кислород', value: patient.oxygen ? 'концентратор дома' : '', tone: 'o2' },
    { label: 'Аллергия', value: patient.allergy, tone: 'alert' },
    { label: 'Раны', value: patient.wounds, tone: 'alert' },
  ].filter((item) => item.value);

  const remove = async () => {
    if (await confirmAction(`Удалить пациента «${patient.fullName}»?\n\nЕсли он может вернуться — лучше в архив.`)) {
      update((d) => removePatient(d, patient.id));
      onBack();
    }
  };

  return (
    <main className="page page--detail">
      <div className="topbar">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft width={20} height={20} />
          Назад
        </button>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => onEdit(patient.id)}>
          <PencilIcon width={18} height={18} />
          Изменить
        </button>
      </div>

      <header className="card-head">
        <h1 className="h1">{patient.fullName}</h1>
        {patient.policy && <p className="card-head__policy num">{patient.policy}</p>}
        {patient.archived && <span className="tag">в архиве</span>}
      </header>

      {patient.hospital && (
        <div className="banner banner--hosp">
          <HospitalIcon />
          <span className="banner__text">
            <b>В больнице с {formatDayShort(patient.hospital.since)}</b>
            {patient.hospital.note && <span>{patient.hospital.note}</span>}
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setHospitalOpen(true)}>
            Выписали
          </button>
        </div>
      )}

      {(patient.address || patient.phones.length > 0) && (
        <section className="group">
          {patient.address && (
            <button type="button" className="line" onClick={() => openLink(placeUrl(patient.address))}>
              <span className="line__text">
                <span>{patient.address}</span>
                {details && <span className="line__sub">{details}</span>}
                {patient.geo && patient.geo.for === patient.address && patient.geo.lat === null && (
                  <span className="line__warn">Не найден на карте — проверьте город, улицу и дом</span>
                )}
              </span>
              <span className="round-btn">
                <NavIcon width={18} height={18} />
              </span>
            </button>
          )}
          {patient.phones.map((phone, i) => (
            <button key={`${phone.number}-${i}`} type="button" className="line" onClick={() => callPhone(phone.number)}>
              <span className="line__text">
                <span className="num">{phone.number}</span>
                {phone.who && <span className="line__sub">{phone.who}</span>}
              </span>
              <span className="round-btn">
                <PhoneIcon width={18} height={18} />
              </span>
            </button>
          ))}
        </section>
      )}

      <section className="block">
        <h2 className="block__title">{patient.schedule.kind === 'every' ? `Визиты ${scheduleLabel(patient.schedule)}` : 'Визиты по датам'}</h2>
        {patient.hospital ? (
          <p className="hint">На паузе, пока в больнице</p>
        ) : upcoming.length ? (
          <div className="dates">
            {upcoming.map((date) => (
              <span key={date} className={cn('date-pill', date === today && 'date-pill--today')}>
                {formatRelative(date, today)}
              </span>
            ))}
          </div>
        ) : (
          <p className="hint">Дальше визитов нет</p>
        )}
        {patient.schedule.kind === 'every' && <p className="hint">С {formatDots(patient.schedule.start)}</p>}
      </section>

      {medical.length > 0 && (
        <section className="group">
          {medical.map((item) => (
            <div key={item.label} className="line line--static">
              <span className={cn('line__label', `line__label--${item.tone}`)}>{item.label}</span>
              <span className="line__value">{item.value}</span>
            </div>
          ))}
        </section>
      )}

      {patient.comment && (
        <section className="block">
          <h2 className="block__title">Комментарий</h2>
          <p className="comment">{patient.comment}</p>
        </section>
      )}

      <div className="actions">
        {!patient.archived && !patient.hospital && (
          <button type="button" className="btn btn--soft" onClick={() => setHospitalOpen(true)}>
            <HospitalIcon width={18} height={18} />
            В больнице
          </button>
        )}
        <button type="button" className="btn btn--soft" onClick={() => update((d) => setArchived(d, patient.id, !patient.archived))}>
          {patient.archived ? 'Вернуть из архива' : 'В архив'}
        </button>
        <button type="button" className="btn btn--danger-text" onClick={remove}>
          Удалить
        </button>
      </div>

      {hospitalOpen && <HospitalSheet patient={patient} today={today} onClose={() => setHospitalOpen(false)} />}
    </main>
  );
};
