import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types.ts';
import { createEmptyData } from '../lib/data.ts';
import { loadData, loadLocal, saveData, type SaveResult } from '../lib/storage.ts';
import { setTheme } from '../lib/telegram.ts';

type Ctx = {
  data: AppData;
  ready: boolean;
  saveState: SaveResult | 'saving';
  update: (change: (data: AppData) => AppData) => void;
  replaceAll: (data: AppData) => void;
};

const DataContext = createContext<Ctx | null>(null);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(() => loadLocal() ?? createEmptyData());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<Ctx['saveState']>('saved');
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(data);

  useEffect(() => {
    let alive = true;
    void loadData().then((loaded) => {
      if (!alive) return;
      latest.current = loaded;
      setData(loaded);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => setTheme(data.settings.theme), [data.settings.theme]);

  const persist = useCallback((next: AppData) => {
    window.clearTimeout(timer.current);
    setSaveState('saving');
    timer.current = window.setTimeout(() => {
      void saveData(latest.current).then(setSaveState);
    }, 500);
    latest.current = next;
  }, []);

  const update = useCallback(
    (change: (data: AppData) => AppData) => {
      setData((current) => {
        const next = { ...change(current), savedAt: new Date().toISOString() };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const replaceAll = useCallback((next: AppData) => update(() => next), [update]);

  return <DataContext.Provider value={{ data, ready, saveState, update, replaceAll }}>{children}</DataContext.Provider>;
};

export const useData = (): Ctx => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData вне DataProvider');
  return ctx;
};
