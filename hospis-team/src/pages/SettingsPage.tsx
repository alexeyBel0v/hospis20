import { useState } from 'react';
import type { IsoDate, Role, Staff, ThemeChoice } from '../types.ts';
import { APP_VERSION } from '../config.ts';
import { useData } from '../hooks/useData.tsx';
import { ApiError, saveStaff, type StaffInput } from '../lib/api.ts';
import { downloadFile } from '../lib/download.ts';
import { roleName, shortName } from '../lib/format.ts';
import { findSame } from '../lib/patients.ts';
import { parseTable, templateCsv, type TableRow } from '../lib/tableImport.ts';
import { confirmAction, haptic } from '../lib/telegram.ts';
import { fetchSiteVersion, isNewer, reloadApp } from '../lib/update.ts';
import { ChevronLeft, ChevronRight, DownloadIcon, PlusIcon } from '../components/icons.tsx';
import { Segmented, Sheet } from '../components/ui.tsx';

/** Много пациентов сразу: скопировать строки из Excel и вставить. */
const ImportSheet = ({ today, onClose }: { today: IsoDate; onClose: () => void }) => {
  const { data, update, users } = useData();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<TableRow[]>([]);
  const [done, setDone] = useState('');

  const read = (raw: string) => {
    setText(raw);
    setDone('');
    setRows(raw.trim() ? parseTable(raw, today, users) : []);
  };

  const fresh = rows.filter((r) => r.patient && !findSame(data.patients, r.patient));
  const already = rows.filter((r) => r.patient && findSame(data.patients, r.patient));
  const broken = rows.filter((r) => !r.patient);

  const apply = () => {
    const incoming = fresh.map((r) => r.patient).filter((p) => p !== null);
    update((d) => ({ ...d, patients: [...d.patients, ...incoming] }));
    haptic('success');
    setDone(`Добавлено пациентов: ${incoming.length}`);
    setText('');
    setRows([]);
  };

  return (
    <Sheet title="Добавить списком" onClose={onClose}>
      <ol className="steps-list">
        <li>Скачайте шаблон и откройте в Excel</li>
        <li>Заполните строки — по пациенту на строку</li>
        <li>Выделите строки вместе с заголовком, скопируйте и вставьте сюда</li>
      </ol>
      <button type="button" className="btn btn--soft btn--block" onClick={() => downloadFile('hospis-shablon.csv', templateCsv())}>
        <DownloadIcon width={18} height={18} />
        Скачать шаблон для Excel
      </button>
      <textarea className="input textarea" rows={5} value={text} placeholder="Вставьте строки из таблицы" aria-label="Строки из таблицы" onChange={(e) => read(e.target.value)} />
      <label className="btn btn--ghost btn--block">
        Или выбрать файл .csv
        <input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => void e.target.files?.[0]?.text().then(read)} />
      </label>
      {rows.length > 0 && (
        <div className="group">
          {fresh.map((r) => (
            <div key={r.line} className="line line--static">
              <span className="line__text">
                <span>{shortName(r.patient?.fullName ?? '')}</span>
                <span className="line__sub">{[r.patient?.address, r.problem].filter(Boolean).join(' · ') || 'без адреса'}</span>
              </span>
            </div>
          ))}
          {already.length > 0 && (
            <div className="line line--static">
              <span className="line__sub">Уже есть, пропущу: {already.map((r) => shortName(r.patient?.fullName ?? '')).join(', ')}</span>
            </div>
          )}
          {broken.length > 0 && (
            <div className="line line--static">
              <span className="line__sub">Без ФИО, пропущу строки: {broken.map((r) => r.line).join(', ')}</span>
            </div>
          )}
        </div>
      )}
      {done && <p className="hint hint--center">{done}</p>}
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!fresh.length} onClick={apply}>
        {fresh.length ? `Добавить ${fresh.length}` : 'Добавить'}
      </button>
    </Sheet>
  );
};

const ROLES: Role[] = ['doctor', 'nurse', 'senior', 'head'];

/** Добавить сотрудника, сменить должность, задать новый пароль, отключить. */
const StaffSheet = ({ person, onClose }: { person: Staff | null; onClose: () => void }) => {
  const { applyView, me } = useData();
  const [name, setName] = useState(person?.name ?? '');
  const [role, setRole] = useState<Role>(person?.role ?? 'nurse');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (input: StaffInput) => {
    setBusy(true);
    setError('');
    try {
      applyView(await saveStaff(input));
      haptic('success');
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не получилось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    void send(person ? { id: person.id, name, role, ...(password ? { password } : {}) } : { name, role, password });

  const disable = async () => {
    if (person && (await confirmAction(`Отключить «${person.name}»?\n\nСотрудник больше не сможет войти. Его пациенты и отметки останутся.`))) {
      void send({ id: person.id, active: false });
    }
  };

  return (
    <Sheet title={person ? 'Сотрудник' : 'Новый сотрудник'} onClose={onClose}>
      <input className="input" value={name} placeholder="Фамилия Имя Отчество" aria-label="ФИО" onChange={(e) => setName(e.target.value)} />
      <select className="input" aria-label="Должность" value={role} disabled={person?.id === me.id} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleName(r)}
          </option>
        ))}
      </select>
      <input
        className="input"
        value={password}
        placeholder={person ? 'Новый пароль (если нужно сменить)' : 'Пароль, минимум 4 символа'}
        aria-label="Пароль"
        autoComplete="new-password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="hint">Пароль сообщите сотруднику лично. Потом он может сменить его сам в настройках.</p>
      {error && <p className="field__error">{error}</p>}
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={busy || !name.trim() || (!person && password.trim().length < 4)} onClick={save}>
        Сохранить
      </button>
      {person && person.id !== me.id && (
        <button type="button" className="btn btn--danger-text btn--block" disabled={busy} onClick={() => void disable()}>
          Отключить доступ
        </button>
      )}
    </Sheet>
  );
};

const PasswordSheet = ({ onClose }: { onClose: () => void }) => {
  const { me } = useData();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const save = async () => {
    try {
      await saveStaff({ id: me.id, password });
      haptic('success');
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не получилось сохранить');
    }
  };
  return (
    <Sheet title="Мой пароль" onClose={onClose}>
      {done ? (
        <p className="hint hint--center">Пароль изменён</p>
      ) : (
        <>
          <input className="input input--lg" type="password" autoComplete="new-password" value={password} placeholder="Новый пароль" aria-label="Новый пароль" onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="field__error">{error}</p>}
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={password.trim().length < 4} onClick={() => void save()}>
            Сменить пароль
          </button>
        </>
      )}
    </Sheet>
  );
};

export const SettingsPage = ({ today, onBack }: { today: IsoDate; onBack: () => void }) => {
  const { data, update, saveState, me, users, isManager, logout } = useData();
  const [importOpen, setImportOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState<Staff | 'new' | null>(null);
  const [note, setNote] = useState('');

  const checkUpdate = async () => {
    setNote('Проверяю…');
    const site = await fetchSiteVersion();
    if (isNewer(site)) reloadApp(site);
    else setNote(site ? 'Стоит последняя версия' : 'Нет связи с сайтом');
  };

  const exit = async () => {
    if (await confirmAction('Выйти? На этом телефоне сможет войти другой сотрудник.')) logout();
  };

  return (
    <main className="page page--detail">
      <div className="topbar">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft width={20} height={20} />
          Назад
        </button>
      </div>
      <h1 className="h1">Настройки</h1>

      <section className="group">
        <div className="line line--static">
          <span className="line__text">
            <span>{me.name}</span>
            <span className="line__sub">
              {roleName(me.role)} · {saveState === 'saving' ? 'сохраняю…' : saveState === 'saved' ? 'всё сохранено' : 'нет связи, сохраню позже'}
            </span>
          </span>
        </div>
        <button type="button" className="line" onClick={() => setPasswordOpen(true)}>
          <span className="line__text">Сменить мой пароль</span>
          <ChevronRight width={18} height={18} />
        </button>
      </section>

      <section className="block">
        <h2 className="block__title">Пациенты списком</h2>
        <button type="button" className="btn btn--soft btn--block" onClick={() => setImportOpen(true)}>
          <PlusIcon width={18} height={18} />
          Добавить из Excel
        </button>
      </section>

      {isManager && (
        <section className="block">
          <h2 className="block__title">Сотрудники</h2>
          <div className="group">
            {users.map((u) => (
              <button key={u.id} type="button" className="line" onClick={() => setStaffOpen(u)}>
                <span className="line__text">
                  <span>{u.name}</span>
                  <span className="line__sub">{roleName(u.role)}</span>
                </span>
                <ChevronRight width={18} height={18} />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--soft btn--block" onClick={() => setStaffOpen('new')}>
            <PlusIcon width={18} height={18} />
            Добавить сотрудника
          </button>
        </section>
      )}

      <section className="block">
        <h2 className="block__title">Тема</h2>
        <Segmented<ThemeChoice>
          label="Тема"
          value={data.settings.theme}
          onChange={(theme) => update((d) => ({ ...d, settings: { ...d.settings, theme } }))}
          options={[
            { value: 'auto', label: 'Авто' },
            { value: 'light', label: 'Светлая' },
            { value: 'dark', label: 'Тёмная' },
          ]}
        />
      </section>

      {note && <p className="hint hint--center">{note}</p>}

      <section className="group">
        <button type="button" className="line" onClick={() => void checkUpdate()}>
          <span className="line__text">
            <span>Проверить обновление</span>
            <span className="line__sub">Версия {APP_VERSION}</span>
          </span>
        </button>
        <button type="button" className="line line--danger" onClick={() => void exit()}>
          <span className="line__text">Выйти — сменить сотрудника</span>
        </button>
      </section>

      {importOpen && <ImportSheet today={today} onClose={() => setImportOpen(false)} />}
      {passwordOpen && <PasswordSheet onClose={() => setPasswordOpen(false)} />}
      {staffOpen && <StaffSheet person={staffOpen === 'new' ? null : staffOpen} onClose={() => setStaffOpen(null)} />}
    </main>
  );
};
