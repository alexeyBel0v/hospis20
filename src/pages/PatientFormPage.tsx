import { useState, type FormEvent } from 'react';
import type { CatheterType, IsoDate, PatientInput, Schedule } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { addressWarning, splitApartment } from '../lib/address.ts';
import { cn } from '../lib/cn.ts';
import { addDays, formatDayShort, isIsoDate } from '../lib/dates.ts';
import { CATHETER_SIZES, CATHETER_TYPES } from '../lib/format.ts';
import { formatPhone, formatPolicy, isPhoneComplete, isPolicyComplete } from '../lib/masks.ts';
import { addPatient, emptyInput, findDuplicateByPolicy, newId, toInput, updatePatient } from '../lib/patients.ts';
import { INTERVALS, upcomingVisits } from '../lib/schedule.ts';
import { haptic } from '../lib/telegram.ts';
import { ChevronLeft, CloseIcon, PlusIcon } from '../components/icons.tsx';
import { Field, Toggle } from '../components/ui.tsx';

type Props = { patientId: string | null; today: IsoDate; onDone: (id: string) => void; onCancel: () => void };

const MAX_PHONES = 4;

export const PatientFormPage = ({ patientId, today, onDone, onCancel }: Props) => {
  const { data, update } = useData();
  const existing = patientId ? data.patients.find((p) => p.id === patientId) : undefined;
  const [form, setForm] = useState<PatientInput>(() => {
    if (existing) return toInput(existing);
    const empty = emptyInput(today);
    return { ...empty, schedule: { kind: 'every', days: 3, start: '' } };
  });
  const [newDate, setNewDate] = useState(today);
  const [tried, setTried] = useState(false);

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSchedule = (schedule: Schedule) => set('schedule', schedule);

  const duplicate = findDuplicateByPolicy(data.patients, form.policy, existing?.id);
  const errors = {
    fullName: form.fullName.trim() ? '' : 'Введите ФИО',
    policy: form.policy && !isPolicyComplete(form.policy) ? 'В полисе 16 цифр' : '',
    schedule:
      form.schedule.kind === 'every'
        ? isIsoDate(form.schedule.start)
          ? ''
          : 'Выберите дату первого визита'
        : form.schedule.dates.length
          ? ''
          : 'Добавьте хотя бы одну дату',
  };
  const valid = !errors.fullName && !errors.policy && !errors.schedule;
  const warn = addressWarning(form.address);
  const preview = isIsoDate(form.schedule.kind === 'every' ? form.schedule.start : '') ? upcomingVisits(form.schedule, form.schedule.kind === 'every' ? form.schedule.start : today, 5) : [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!valid) {
      haptic('error');
      return;
    }
    haptic('success');
    if (existing) {
      update((d) => updatePatient(d, existing.id, form));
      onDone(existing.id);
    } else {
      const id = newId();
      update((d) => addPatient(d, form, id).data);
      onDone(id);
    }
  };

  const err = (key: keyof typeof errors) => (tried ? errors[key] : '') || undefined;

  return (
    <main className="page page--form">
      <div className="topbar">
        <button type="button" className="back" onClick={onCancel}>
          <ChevronLeft width={20} height={20} />
          Отмена
        </button>
      </div>
      <h1 className="h1">{existing ? 'Изменить' : 'Новый пациент'}</h1>

      <form className="form" onSubmit={submit} noValidate>
        <section className="form-block">
          <Field label="ФИО" htmlFor="fullName" error={err('fullName')}>
            <input id="fullName" className="input" value={form.fullName} autoComplete="off" placeholder="Иванов Иван Иванович" onChange={(e) => set('fullName', e.target.value)} />
          </Field>
          <Field label="Полис" htmlFor="policy" error={err('policy')} hint={duplicate ? `Такой полис уже у «${duplicate.fullName}»` : undefined}>
            <input id="policy" className="input num" inputMode="numeric" value={form.policy} placeholder="0000 0000 0000 0000" onChange={(e) => set('policy', formatPolicy(e.target.value))} />
          </Field>
        </section>

        <section className="form-block">
          <Field
            label="Адрес"
            htmlFor="address"
            hint={
              warn ? (
                <span className="warn">
                  {warn}
                  {splitApartment(form.address).apartment && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        const parts = splitApartment(form.address);
                        setForm((f) => ({ ...f, address: parts.address, apartment: parts.apartment }));
                      }}
                    >
                      Перенести
                    </button>
                  )}
                </span>
              ) : undefined
            }
          >
            <input id="address" className="input" value={form.address} autoComplete="off" placeholder="Москва, Профсоюзная ул., 104" onChange={(e) => set('address', e.target.value)} />
          </Field>
          <div className="grid-4">
            {(
              [
                ['apartment', 'Кв.'],
                ['entrance', 'Подъезд'],
                ['floor', 'Этаж'],
                ['intercom', 'Домофон'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label} htmlFor={key}>
                <input id={key} className="input input--center" inputMode={key === 'intercom' ? 'text' : 'numeric'} value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </Field>
            ))}
          </div>
        </section>

        <section className="form-block">
          <p className="field__label">Телефоны</p>
          {form.phones.map((phone, i) => (
            <div key={i} className="phone-edit">
              <input
                className={cn('input num', tried && phone.number && !isPhoneComplete(phone.number) && 'input--error')}
                inputMode="tel"
                value={phone.number}
                placeholder="+7 900 000-00-00"
                aria-label={`Телефон ${i + 1}`}
                onChange={(e) => set('phones', form.phones.map((p, j) => (j === i ? { ...p, number: formatPhone(e.target.value) } : p)))}
              />
              <input className="input" value={phone.who} placeholder="Чей: дочь Марина" aria-label={`Чей телефон ${i + 1}`} onChange={(e) => set('phones', form.phones.map((p, j) => (j === i ? { ...p, who: e.target.value } : p)))} />
              {form.phones.length > 1 && (
                <button type="button" className="icon-btn icon-btn--ghost" aria-label="Убрать телефон" onClick={() => set('phones', form.phones.filter((_, j) => j !== i))}>
                  <CloseIcon width={18} height={18} />
                </button>
              )}
            </div>
          ))}
          {form.phones.length < MAX_PHONES && (
            <button type="button" className="link-btn" onClick={() => set('phones', [...form.phones, { number: '', who: '' }])}>
              <PlusIcon width={16} height={16} />
              Ещё телефон
            </button>
          )}
        </section>

        <section className="form-block">
          <p className="field__label">График визитов</p>
          <div className="chips chips--wrap">
            {INTERVALS.map((days) => (
              <button
                key={days}
                type="button"
                className={cn('chip', form.schedule.kind === 'every' && form.schedule.days === days && 'chip--on')}
                onClick={() => setSchedule({ kind: 'every', days, start: form.schedule.kind === 'every' ? form.schedule.start : '' })}
              >
                {days === 1 ? 'Каждый день' : `1/${days}`}
              </button>
            ))}
            <button type="button" className={cn('chip', form.schedule.kind === 'dates' && 'chip--on')} onClick={() => setSchedule({ kind: 'dates', dates: form.schedule.kind === 'dates' ? form.schedule.dates : [] })}>
              Свои даты
            </button>
          </div>

          {form.schedule.kind === 'every' ? (
            <Field label="Первый визит" htmlFor="start" error={err('schedule')}>
              <div className="chips">
                {[0, 1].map((shift) => {
                  const date = addDays(today, shift);
                  const schedule = form.schedule;
                  return (
                    <button key={date} type="button" className={cn('chip', schedule.kind === 'every' && schedule.start === date && 'chip--on')} onClick={() => schedule.kind === 'every' && setSchedule({ ...schedule, start: date })}>
                      {shift === 0 ? 'Сегодня' : 'Завтра'}
                    </button>
                  );
                })}
                <input
                  id="start"
                  className="input input--date"
                  type="date"
                  value={form.schedule.start}
                  onChange={(e) => form.schedule.kind === 'every' && setSchedule({ ...form.schedule, start: e.target.value })}
                />
              </div>
              {preview.length > 0 && <p className="field__hint">Визиты: {preview.map(formatDayShort).join(', ')}…</p>}
            </Field>
          ) : (
            <Field label="Даты визитов" error={err('schedule')}>
              <div className="chips chips--wrap">
                {form.schedule.dates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className="chip chip--on chip--removable"
                    aria-label={`Убрать ${formatDayShort(date)}`}
                    onClick={() => form.schedule.kind === 'dates' && setSchedule({ kind: 'dates', dates: form.schedule.dates.filter((d) => d !== date) })}
                  >
                    {formatDayShort(date)} ×
                  </button>
                ))}
              </div>
              <div className="phone-edit">
                <input className="input" type="date" value={newDate} aria-label="Новая дата" onChange={(e) => setNewDate(e.target.value)} />
                <button
                  type="button"
                  className="btn btn--soft"
                  disabled={!isIsoDate(newDate)}
                  onClick={() => form.schedule.kind === 'dates' && setSchedule({ kind: 'dates', dates: [...new Set([...form.schedule.dates, newDate])].sort() })}
                >
                  Добавить
                </button>
              </div>
            </Field>
          )}
        </section>

        <section className="form-block">
          <p className="field__label">Катетер</p>
          <div className="chips chips--wrap">
            {CATHETER_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className={cn('chip', form.catheter.type === type.value && 'chip--on')}
                onClick={() => set('catheter', { type: type.value as CatheterType, size: type.value === 'none' ? null : form.catheter.size })}
              >
                {type.label}
              </button>
            ))}
          </div>
          {form.catheter.type !== 'none' && (
            <div className="chips chips--wrap">
              {CATHETER_SIZES.map((size) => (
                <button key={size} type="button" className={cn('chip chip--small', form.catheter.size === size && 'chip--on')} onClick={() => set('catheter', { ...form.catheter, size })}>
                  Ch {size}
                </button>
              ))}
            </div>
          )}
          <div className="row-between">
            <span>Кислородный концентратор</span>
            <Toggle checked={form.oxygen} label="Кислородный концентратор" onChange={(v) => set('oxygen', v)} />
          </div>
          <Field label="Аллергия" htmlFor="allergy">
            <input id="allergy" className="input" value={form.allergy} placeholder="Нет" onChange={(e) => set('allergy', e.target.value)} />
          </Field>
          <Field label="Раны, пролежни" htmlFor="wounds">
            <input id="wounds" className="input" value={form.wounds} placeholder="Нет" onChange={(e) => set('wounds', e.target.value)} />
          </Field>
        </section>

        <section className="form-block">
          <Field label="Комментарий" htmlFor="comment">
            <textarea id="comment" className="input textarea" rows={3} value={form.comment} placeholder="Когда приходить, родственники, ключи" onChange={(e) => set('comment', e.target.value)} />
          </Field>
        </section>

        <div className="form-submit">
          <button type="submit" className="btn btn--primary btn--lg btn--block">
            {existing ? 'Сохранить' : 'Добавить пациента'}
          </button>
        </div>
      </form>
    </main>
  );
};
