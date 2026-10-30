import { useState } from 'react';
import type { IsoDate, ThemeChoice } from '../types.ts';
import { APP_VERSION } from '../config.ts';
import { useData } from '../hooks/useData.tsx';
import { copyText } from '../lib/clipboard.ts';
import { createEmptyData, DataError, parseDataJson } from '../lib/data.ts';
import { createDemoData } from '../lib/demo.ts';
import { forgetUnlock } from '../lib/password.ts';
import { clearAll } from '../lib/storage.ts';
import { confirmAction, haptic, telegramUser } from '../lib/telegram.ts';
import { fetchSiteVersion, isNewer, reloadApp } from '../lib/update.ts';
import { ChevronLeft } from '../components/icons.tsx';
import { Segmented, Sheet } from '../components/ui.tsx';

const ImportSheet = ({ onClose }: { onClose: () => void }) => {
  const { replaceAll } = useData();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const apply = async (raw: string) => {
    try {
      const data = parseDataJson(raw);
      if (!(await confirmAction(`Заменить текущие данные?\n\nВ копии пациентов: ${data.patients.length}.`))) return;
      replaceAll(data);
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

export const SettingsPage = ({ today, onBack }: { today: IsoDate; onBack: () => void }) => {
  const { data, update, replaceAll, saveState } = useData();
  const [importOpen, setImportOpen] = useState(false);
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
    replaceAll(createEmptyData());
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
    </main>
  );
};
