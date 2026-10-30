import { PASSWORD_HASH } from '../config.ts';
import { cloudStorage } from './telegram.ts';

const KEY = 'hospis_unlock';
const CLOUD_KEY = 'h2_unlock';

export const hashPassword = async (password: string): Promise<string> => {
  const bytes = new TextEncoder().encode(`hospis-os:${password.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const checkPassword = async (password: string): Promise<boolean> => (await hashPassword(password)) === PASSWORD_HASH;

/** Пароль вводится один раз на телефоне; если его сменят в коде — спросит снова. */
export const isUnlocked = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === PASSWORD_HASH;
  } catch {
    return false;
  }
};

export const isUnlockedInCloud = (): Promise<boolean> =>
  new Promise((resolve) => {
    const cloud = cloudStorage();
    if (!cloud) return resolve(false);
    const timer = window.setTimeout(() => resolve(false), 2500);
    cloud.getItem(CLOUD_KEY, (err, value) => {
      window.clearTimeout(timer);
      resolve(!err && value === PASSWORD_HASH);
    });
  });

export const rememberUnlock = () => {
  try {
    window.localStorage.setItem(KEY, PASSWORD_HASH);
  } catch {
    // нет доступа
  }
  cloudStorage()?.setItem(CLOUD_KEY, PASSWORD_HASH);
};

export const forgetUnlock = () => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // нет доступа
  }
  cloudStorage()?.removeItems([CLOUD_KEY]);
};
