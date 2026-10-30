import type { ThemeChoice } from '../types.ts';
import { phoneHref } from './masks.ts';

type CloudStorage = {
  setItem: (key: string, value: string, cb?: (err: string | null, ok?: boolean) => void) => void;
  getItem: (key: string, cb: (err: string | null, value?: string) => void) => void;
  getItems: (keys: string[], cb: (err: string | null, values?: Record<string, string>) => void) => void;
  removeItems: (keys: string[], cb?: (err: string | null, ok?: boolean) => void) => void;
  getKeys: (cb: (err: string | null, keys?: string[]) => void) => void;
};

type ButtonApi = { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };

type WebApp = {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  version: string;
  colorScheme?: 'light' | 'dark';
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  openLink?: (url: string) => void;
  showConfirm?: (message: string, cb: (ok: boolean) => void) => void;
  onEvent?: (event: string, cb: () => void) => void;
  BackButton?: ButtonApi;
  HapticFeedback?: { impactOccurred: (style: 'light' | 'medium') => void; notificationOccurred: (type: 'success' | 'error') => void };
  CloudStorage?: CloudStorage;
};

const webApp = (): WebApp | null => {
  const tg = (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
  return tg && tg.initData ? tg : null;
};

export const inTelegram = (): boolean => webApp() !== null;

export const telegramUser = () => webApp()?.initDataUnsafe?.user ?? null;

export const cloudStorage = (): CloudStorage | null => {
  const tg = webApp();
  if (!tg?.CloudStorage) return null;
  if (tg.isVersionAtLeast && !tg.isVersionAtLeast('6.9')) return null;
  return tg.CloudStorage;
};

let themeChoice: ThemeChoice = 'auto';

const systemDark = () => {
  const tg = webApp();
  if (tg?.colorScheme) return tg.colorScheme === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

const applyTheme = () => {
  const dark = themeChoice === 'dark' || (themeChoice === 'auto' && systemDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const bg = dark ? '#0e1417' : '#f2f5f4';
  const tg = webApp();
  try {
    tg?.setHeaderColor?.(bg);
    tg?.setBackgroundColor?.(bg);
    tg?.setBottomBarColor?.(dark ? '#151d21' : '#ffffff');
  } catch {
    // старые версии Telegram
  }
};

export const setTheme = (choice: ThemeChoice) => {
  themeChoice = choice;
  applyTheme();
};

export const initTelegram = () => {
  const tg = webApp();
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.disableVerticalSwipes?.();
    } catch {
      // не везде есть
    }
    tg.onEvent?.('themeChanged', applyTheme);
  }
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  applyTheme();
};

export const haptic = (kind: 'tap' | 'success' | 'error' = 'tap') => {
  const h = webApp()?.HapticFeedback;
  if (!h) return;
  if (kind === 'tap') h.impactOccurred('light');
  else h.notificationOccurred(kind);
};

export const openLink = (url: string) => {
  const tg = webApp();
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
};

export const callPhone = (number: string) => {
  window.location.href = phoneHref(number);
};

export const confirmAction = (message: string): Promise<boolean> =>
  new Promise((resolve) => {
    const tg = webApp();
    if (tg?.showConfirm) tg.showConfirm(message, resolve);
    else resolve(window.confirm(message));
  });

/** Кнопка «Назад» Telegram: показывается, пока есть хоть один обработчик. */
const backHandlers: Array<() => void> = [];
const onBack = () => backHandlers[backHandlers.length - 1]?.();
let backBound = false;

export const pushBack = (handler: () => void): (() => void) => {
  const button = webApp()?.BackButton;
  backHandlers.push(handler);
  if (button) {
    if (!backBound) {
      button.onClick(onBack);
      backBound = true;
    }
    button.show();
  }
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
    if (button && backHandlers.length === 0) button.hide();
  };
};
