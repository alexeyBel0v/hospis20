import { APP_VERSION } from '../config.ts';

/** Версия, которая сейчас лежит на сайте (в обход кэша). null — нет связи. */
export const fetchSiteVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'version' in body && typeof body.version === 'string') return body.version;
    return null;
  } catch {
    return null;
  }
};

const TRIED_KEY = 'hospis_reload_tried';

const alreadyTried = (version: string): boolean => {
  try {
    return window.sessionStorage.getItem(TRIED_KEY) === version;
  } catch {
    return false;
  }
};

/** На сайте другая версия — и мы ещё не пробовали на неё перезапуститься (защита от бесконечной перезагрузки). */
export const isNewer = (site: string | null): site is string => Boolean(site && site !== APP_VERSION && !alreadyTried(site));

/** Перезапуск с новой меткой в адресе — WebView точно возьмёт свежие файлы. Данные не трогаются. */
export const reloadApp = (version: string) => {
  try {
    window.sessionStorage.setItem(TRIED_KEY, version);
  } catch {
    // нет доступа
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', version);
  window.location.replace(url.toString());
};
