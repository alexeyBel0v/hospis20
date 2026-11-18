import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData, Staff } from '../types.ts';
import { createEmptyData } from '../lib/data.ts';
import { getSession, setSession, type ServerView } from '../lib/api.ts';
import { diff, fromServer, hasChanges, keepLocal, loadLocal, sync } from '../lib/storage.ts';
import { setTheme } from '../lib/telegram.ts';

export type SaveState = 'saved' | 'saving' | 'offline';

type Ctx = {
  data: AppData;
  ready: boolean;
  saveState: SaveState;
  me: Staff;
  users: Staff[];
  isManager: boolean;
  update: (change: (data: AppData) => AppData) => void;
  replaceAll: (data: AppData) => void;
  /** Сервер прислал новую картину (например, после правки сотрудников). */
  applyView: (view: ServerView) => void;
  logout: () => void;
};

const DataContext = createContext<Ctx | null>(null);

export const DataProvider = ({ children, onLogout }: { children: ReactNode; onLogout: () => void }) => {
  const session = getSession();
  const initial = useRef(loadLocal());
  const [data, setData] = useState<AppData>(() => initial.current?.data ?? createEmptyData());
  const [server, setServer] = useState<ServerView | null>(() => initial.current?.server ?? null);
  const [ready, setReady] = useState(Boolean(initial.current?.server));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const latest = useRef(data);
  const serverRef = useRef(server);
  const timer = useRef<number | undefined>(undefined);
  const busy = useRef(false);

  const logout = useCallback(() => {
    setSession(null);
    onLogout();
  }, [onLogout]);

  /** Отправить правки и подтянуть то, что изменили другие. */
  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const sent = latest.current;
    const result = await sync(sent, serverRef.current);
    busy.current = false;
    if (result.state === 'logout') return logout();
    serverRef.current = result.server;
    setServer(result.server);
    setReady(true);
    setSaveState(result.state === 'saved' ? 'saved' : 'offline');
    // Пока ждали сервер, на телефоне что-то поменяли — не затираем, отправим следующим заходом.
    if (latest.current === sent) {
      latest.current = result.data;
      setData(result.data);
    } else if (result.state === 'saved') {
      window.setTimeout(() => void run(), 300);
    }
  }, [logout]);

  useEffect(() => {
    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    const every = window.setInterval(onVisible, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(every);
    };
  }, [run]);

  useEffect(() => setTheme(data.settings.theme), [data.settings.theme]);

  const update = useCallback(
    (change: (data: AppData) => AppData) => {
      const next = { ...change(latest.current), savedAt: new Date().toISOString() };
      latest.current = next;
      setData(next);
      keepLocal(next, serverRef.current);
      if (hasChanges(diff(next, serverRef.current))) {
        setSaveState('saving');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void run(), 400);
      }
    },
    [run],
  );

  const replaceAll = useCallback((next: AppData) => update(() => next), [update]);

  const applyView = useCallback((view: ServerView) => {
    serverRef.current = view;
    setServer(view);
    const next = fromServer(view, latest.current.shifts, latest.current.settings);
    latest.current = next;
    setData(next);
    keepLocal(next, view);
  }, []);

  const me = server?.me ?? session?.user ?? { id: '', name: '', role: 'nurse' };
  const isManager = me.role === 'head' || me.role === 'senior';

  return (
    <DataContext.Provider value={{ data, ready, saveState, me, users: server?.users ?? [], isManager, update, replaceAll, applyView, logout }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): Ctx => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData вне DataProvider');
  return ctx;
};
