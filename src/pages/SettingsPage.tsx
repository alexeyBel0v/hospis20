import { useState } from 'react';
import type { IsoDate, ThemeChoice } from '../types.ts';
import { APP_VERSION } from '../config.ts';
import { useData } from '../hooks/useData.tsx';
import { copyText } from '../lib/clipboard.ts';
import { createEmptyData, DataError, parseDataJson, parseIncomingPatients } from '../lib/data.ts';
import { mergePatients } from '../lib/patients.ts';
import { shortName } from '../lib/format.ts';
import type { Patient } from '../types.ts';
import { createDemoData } from '../lib/demo.ts';
import { forgetUnlock } from '../lib/password.ts';
import { clearAll } from '../lib/storage.ts';
import { confirmAction, haptic, telegramUser } from '../lib/telegram.ts';
import { fetchSiteVersion, isNewer, reloadApp } from '../lib/update.ts';
import { ChevronLeft } from '../components/icons.tsx';
import { Segmented, Sheet } from '../components/ui.tsx';

const ImportSheet = ({ onClose }: { onClose: () => void }) => {
  const { data: current, replaceAll } = useData();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const apply = async (raw: string) => {
    try {
      const data = parseDataJson(raw);
      if (!(await confirmAction(`Заменить текущие данные?\n\nВ копии пациентов: ${data.patients.length}.`))) return;
      const kept = new Set(data.patients.map((p) => p.id));
      replaceAll({ ...data, deleted: [...data.deleted, ...current.patients.filter((p) => !kept.has(p.id)).map((p) => p.id)] });
      haptic('success');
      onClose();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Не получилось прочитать копию');
    }
  };
  return (
    <Sheet title="Восстановить из копии" onClose={onClose}>
      <textarea className="input textarea" rows={5} value={text} placeholder="Вставьте текст копии" aria-label="Текст копии" onChange={(e) => setText(e.target.value)} />
      <label className="btn btn--soft btn--block">
        Выбрать файл
        <input type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => void e.target.files?.[0]?.text().then(apply)} />
      </label>
      {error && <p className="field__error">{error}</p>}
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!text.trim()} onClick={() => void apply(text)}>
        Восстановить
      </button>
    </Sheet>
  );
};

/** Добавить пациентов к своим (из списка, который подготовил Claude по фото): совпавшие пропускаются. */
const AddSheet = ({ onClose }: { onClose: () => void }) => {
  const { data, update } = useData();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ added: Patient[]; skipped: Patient[]; incoming: Patient[] } | null>(null);
  const [done, setDone] = useState('');

  const check = (raw: string) => {
    setError('');
    setDone('');
    try {
      const incoming = parseIncomingPatients(raw);
      const { added, skipped } = mergePatients(data, incoming);
      setPreview({ added, skipped, incoming });
    } catch (e) {
      setPreview(null);
      setError(e instanceof DataError ? e.message : 'Не получилось прочитать список');
    }
  };

  const apply = () => {
    if (!preview) return;
    update((d) => mergePatients(d, preview.incoming).data);
    haptic('success');
    setDone(`Добавлено: ${preview.added.length}`);
    setPreview(null);
    setText('');
  };

  return (
    <Sheet title="Добавить пациентов" onClose={onClose}>
      <p className="hint">Вставьте список или выберите файл. Пациенты добавятся к вашим, уже имеющиеся пропустятся.</p>
      <textarea
        className="input textarea"
        rows={5}
        value={text}
        placeholder="Вставьте текст списка"
        aria-label="Текст списка"
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) check(e.target.value);
          else setPreview(null);
        }}
      />
      <label className="btn btn--soft btn--block">
        Выбрать файл
        <input type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => void e.target.files?.[0]?.text().then((t) => { setText(t); check(t); })} />
      </label>
      {error && <p className="field__error">{error}</p>}
      {preview && (
        <div className="group">
          {preview.added.map((p) => (
            <div key={p.id} className="line line--static">
              <span className="line__text">
                <span>{shortName(p.fullName)}</span>
                <span className="line__sub">{[p.policy, p.address].filter(Boolean).join(', ') || 'без полиса и адреса'}</span>
              </span>
            </div>
          ))}
          {preview.skipped.length > 0 && (
            <div className="line line--static">
              <span className="line__sub">Уже есть, пропущу: {preview.skipped.map((p) => shortName(p.fullName)).join(', ')}</span>
            </div>
          )}
        </div>
      )}
      {done && <p className="hint hint--center">{done}</p>}
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!preview?.added.length} onClick={apply}>
        {preview ? `Добавить ${preview.added.length}` : 'Добавить'}
      </button>
    </Sheet>
  );
};

export const SettingsPage = ({ today, onBack }: { today: IsoDate; onBack: () => void }) => {
  const { data, update, replaceAll, saveState } = useData();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [note, setNote] = useState('');
  const user = telegramUser();

  const backup = JSON.stringify({ app: 'Hospis OS', exportedAt: new Date().toISOString(), data });

  const copyBackup = async () => {
    const ok = await copyText(backup);
    setNote(ok ? 'Копия в буфере — вставьте в «Избранное» Telegram' : 'Не получилось скопировать');
  };

  const downloadBackup = () => {
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hospis-backup-${today}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const checkUpdate = async () => {
    setNote('Проверяю…');
    const site = await fetchSiteVersion();
    if (isNewer(site)) reloadApp(site);
    else setNote(site ? 'Стоит последняя версия' : 'Нет связи с сайтом');
  };

  const wipe = async () => {
    if (!(await confirmAction('Удалить всех пациентов и смены?\n\nВосстановить можно только из резервной копии.'))) return;
    await clearAll();
    // Список удалённых — чтобы другие устройства тоже их убрали, а не вернули при синхронизации.
    replaceAll({ ...createEmptyData(), deleted: data.patients.map((p) => p.id) });
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
            <span>{user ? [user.first_name, user.username && `@${user.username}`].filter(Boolean).join(' ') : 'Вне Telegram'}</span>
            <span className="line__sub">
              {saveState === 'saving' ? 'Сохраняю…' : saveState === 'saved' ? 'Данные в облаке Telegram' : 'Данные только на этом телефоне'}
            </span>
          </span>
        </div>
      </section>

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

      <section className="block">
        <h2 className="block__title">Пациенты списком</h2>
        <button type="button" className="btn btn--soft btn--block" onClick={() => setAddOpen(true)}>
          Добавить пациентов из списка
        </button>
      </section>

      <section className="block">
        <h2 className="block__title">Резервная копия</h2>
        <div className="grid-2">
          <button type="button" className="btn btn--soft" onClick={() => void copyBackup()}>
            Скопировать
          </button>
          <button type="button" className="btn btn--soft" onClick={downloadBackup}>
            Скачать файл
          </button>
        </div>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setImportOpen(true)}>
          Восстановить из копии
        </button>
        {import.meta.env.DEV && data.patients.length === 0 && (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => replaceAll(createDemoData(today))}>
            Загрузить пример
          </button>
        )}
      </section>

      {note && <p className="hint hint--center">{note}</p>}

      <section className="group">
        <button type="button" className="line" onClick={() => void checkUpdate()}>
          <span className="line__text">
            <span>Проверить обновление</span>
            <span className="line__sub">Версия {APP_VERSION}</span>
          </span>
        </button>
        <button
          type="button"
          className="line"
          onClick={() => {
            forgetUnlock();
            window.location.reload();
          }}
        >
          <span className="line__text">Выйти (спросит пароль)</span>
        </button>
        <button type="button" className="line line--danger" onClick={() => void wipe()}>
          <span className="line__text">Удалить все данные</span>
        </button>
      </section>

      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} />}
      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
    </main>
  );
};
