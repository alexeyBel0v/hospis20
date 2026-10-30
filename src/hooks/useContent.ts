import { useCallback, useEffect, useState } from 'react';
import { parseInfo, parseNews, type InfoSection, type NewsItem } from '../lib/content.ts';

type State = { news: NewsItem[]; info: InfoSection[]; status: 'loading' | 'ok' | 'offline' };

const CACHE_KEY = 'hospis_content';

const readCache = (): { news: string; info: string } | null => {
  try {
    const text = window.localStorage.getItem(CACHE_KEY);
    return text ? (JSON.parse(text) as { news: string; info: string }) : null;
  } catch {
    return null;
  }
};

const fetchText = async (file: string): Promise<string> => {
  const response = await fetch(`./${file}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(String(response.status));
  return response.text();
};

const fromTexts = (news: string, info: string, status: State['status']): State => ({ news: parseNews(news), info: parseInfo(info), status });

let shared: State | null = null;
const listeners = new Set<(state: State) => void>();

const publish = (state: State) => {
  shared = state;
  listeners.forEach((listener) => listener(state));
};

/** Новости и справка — общие для всех: берутся с сайта при каждом открытии, без кэша. */
const refresh = async () => {
  try {
    const [news, info] = await Promise.all([fetchText('news.md'), fetchText('info.md')]);
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ news, info }));
    } catch {
      // нет места — не страшно
    }
    publish(fromTexts(news, info, 'ok'));
  } catch {
    const cached = readCache();
    publish(cached ? fromTexts(cached.news, cached.info, 'offline') : { news: [], info: [], status: 'offline' });
  }
};

export const useContent = () => {
  const [state, setState] = useState<State>(() => {
    if (shared) return shared;
    const cached = readCache();
    return cached ? fromTexts(cached.news, cached.info, 'loading') : { news: [], info: [], status: 'loading' };
  });

  useEffect(() => {
    listeners.add(setState);
    if (!shared) void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(setState);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const reload = useCallback(() => {
    publish({ ...(shared ?? state), status: 'loading' });
    void refresh();
  }, [state]);

  return { ...state, reload };
};
