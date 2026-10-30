import type { ReactNode } from 'react';
import type { IsoDate, Patient } from '../types.ts';
import { addressDetails, placeUrl } from '../lib/address.ts';
import { cn } from '../lib/cn.ts';
import { formatDayShort, formatRelative } from '../lib/dates.ts';
import { catheterLabel, policyLine, shortName } from '../lib/format.ts';
import { nextVisitDate, scheduleLabel } from '../lib/schedule.ts';
import { callPhone, haptic, openLink } from '../lib/telegram.ts';
import { ChevronDown, ChevronRight, NavIcon, PhoneIcon } from './icons.tsx';

export const Flags = ({ patient }: { patient: Patient }) => (
  <>
    {patient.catheter.type !== 'none' && <span className="flag flag--cath">К</span>}
    {patient.oxygen && <span className="flag flag--o2">O₂</span>}
    {patient.allergy && <span className="flag flag--alert">!</span>}
  </>
);

const Peek = ({ patient, today, onOpen }: { patient: Patient; today: IsoDate; onOpen: () => void }) => {
  const details = addressDetails(patient);
  const next = nextVisitDate(patient.schedule, today);
  const facts = [catheterLabel(patient) && `Катетер: ${catheterLabel(patient)}`, patient.oxygen && 'Кислородный концентратор', patient.allergy && `Аллергия: ${patient.allergy}`].filter(Boolean);

  return (
    <div className="peek">
      <p className="peek__name">{patient.fullName}</p>

      {patient.address && (
        <button type="button" className="peek__row" onClick={() => openLink(placeUrl(patient.address))}>
          <span className="peek__text">
            <span>{patient.address}</span>
            {details && <span className="peek__sub">{details}</span>}
          </span>
          <span className="round-btn" aria-hidden="true">
            <NavIcon width={18} height={18} />
          </span>
        </button>
      )}

      {patient.phones.map((phone, i) => (
        <button key={`${phone.number}-${i}`} type="button" className="peek__row" onClick={() => callPhone(phone.number)}>
          <span className="peek__text">
            <span className="num">{phone.number}</span>
            {phone.who && <span className="peek__sub">{phone.who}</span>}
          </span>
          <span className="round-btn" aria-hidden="true">
            <PhoneIcon width={18} height={18} />
          </span>
        </button>
      ))}

      {facts.length > 0 && <p className="peek__facts">{facts.join('. ')}</p>}
      {patient.comment && <p className="peek__comment">{patient.comment}</p>}

      <div className="peek__foot">
        <span className="peek__sub">
          {patient.hospital
            ? `В больнице с ${formatDayShort(patient.hospital.since)}`
            : `${scheduleLabel(patient.schedule)}${next ? `, следующий визит ${formatRelative(next, today)}` : ''}`}
        </span>
        <button type="button" className="link-btn" onClick={onOpen}>
          Карточка
          <ChevronRight width={16} height={16} />
        </button>
      </div>
    </div>
  );
};

type Props = {
  patient: Patient;
  today: IsoDate;
  open: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  aside?: ReactNode;
  tone?: 'default' | 'muted';
};

/** Строка «Фамилия И. О.» + полис. Нажатие раскрывает адрес, телефоны и комментарий. */
export const PatientRow = ({ patient, today, open, onToggle, onOpen, aside, tone = 'default' }: Props) => (
  <div className={cn('prow', open && 'prow--open', tone === 'muted' && 'prow--muted')}>
    <button
      type="button"
      className="prow__head"
      aria-expanded={open}
      onClick={() => {
        haptic();
        onToggle(patient.id);
      }}
    >
      <span className="prow__main">
        <span className="prow__name">
          <span className="prow__name-text">{shortName(patient.fullName)}</span>
          <Flags patient={patient} />
        </span>
        <span className="prow__sub num">{policyLine(patient)}</span>
      </span>
      {aside}
      <ChevronDown width={18} height={18} className={cn('chev', open && 'chev--open')} />
    </button>
    {open && <Peek patient={patient} today={today} onOpen={() => onOpen(patient.id)} />}
  </div>
);
