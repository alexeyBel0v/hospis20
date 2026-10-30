import { useEffect, useState } from 'react';
import { useContent } from './hooks/useContent.ts';
import { useData } from './hooks/useData.tsx';
import { useBack } from './hooks/useBack.ts';
import { useToday } from './hooks/useToday.ts';
import { fetchSiteVersion, isNewer, reloadApp } from './lib/update.ts';
import { BottomNav, type Tab } from './components/BottomNav.tsx';
import { NewsPage } from './pages/NewsPage.tsx';
import { PatientFormPage } from './pages/PatientFormPage.tsx';
import { PatientPage } from './pages/PatientPage.tsx';
import { PatientsPage } from './pages/PatientsPage.tsx';
import { SchedulePage } from './pages/SchedulePage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { TodayPage } from './pages/TodayPage.tsx';

type Screen = { kind: 'patient'; id: string } | { kind: 'form'; id: string | null } | { kind: 'settings' };

export const App = () => {
  const today = useToday();
  const { data } = useData();
  const { news } = useContent();
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);
  const [update, setUpdate] = useState<string | null>(null);
  const top = stack[stack.length - 1];

  const push = (screen: Screen) => {
    setStack((s) => [...s, screen]);
    window.scrollTo(0, 0);
  };
  const back = () => setStack((s) => s.slice(0, -1));
  useBack(top ? back : null);

  // Вернулись в приложение — проверяем, не вышла ли новая версия. На главных экранах обновляемся сразу.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const site = await fetchSiteVersion();
      if (isNewer(site)) setUpdate(site);
    };
    void check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  useEffect(() => {
    if (update && stack.length === 0) reloadApp(update);
  }, [update, stack.length]);

  const openPatient = (id: string) => push({ kind: 'patient', id });
  const newsBadge = news.filter((n) => !data.settings.seenNews.includes(n.id)).length;

  const screen = () => {
    if (top?.kind === 'patient') return <PatientPage key={top.id} patientId={top.id} today={today} onBack={back} onEdit={(id) => push({ kind: 'form', id })} />;
    if (top?.kind === 'form') {
      return (
        <PatientFormPage
          key={top.id ?? 'new'}
          patientId={top.id}
          today={today}
          onCancel={back}
          onDone={(id) => setStack((s) => [...s.slice(0, -1).filter((x) => !(x.kind === 'patient' && x.id === id)), { kind: 'patient', id }])}
        />
      );
    }
    if (top?.kind === 'settings') return <SettingsPage today={today} onBack={back} />;
    if (tab === 'patients') return <PatientsPage today={today} onOpenPatient={openPatient} onAddPatient={() => push({ kind: 'form', id: null })} />;
    if (tab === 'schedule') return <SchedulePage today={today} onOpenPatient={openPatient} />;
    if (tab === 'news') return <NewsPage />;
    return (
      <TodayPage
        today={today}
        onOpenPatient={openPatient}
        onAddPatient={() => push({ kind: 'form', id: null })}
        onOpenSettings={() => push({ kind: 'settings' })}
        onOpenNews={() => setTab('news')}
        onOpenSchedule={() => setTab('schedule')}
      />
    );
  };

  return (
    <>
      {update && stack.length > 0 && (
        <button type="button" className="update-bar" onClick={() => reloadApp(update)}>
          Вышла новая версия <b>Обновить</b>
        </button>
      )}
      <div key={top ? `${top.kind}-${stack.length}` : tab} className="screen">
        {screen()}
      </div>
      {!top && (
        <BottomNav
          active={tab}
          newsBadge={newsBadge}
          onChange={(next) => {
            setTab(next);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </>
  );
};
