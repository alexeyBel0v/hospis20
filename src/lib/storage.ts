import type { AppData } from '../types.ts';
import { createEmptyData, parseData } from './data.ts';
import { cloudStorage } from './telegram.ts';

/**
 * Где лежат данные:
 * 1) на телефоне (localStorage) — мгновенный запуск и работа без связи;
 * 2) в облаке Telegram (CloudStorage) — копия, привязанная к аккаунту: тот же список на другом телефоне.
 * Облако хранит строки до 4096 символов, поэтому данные режутся на куски.
 */

const LOCAL_KEY = 'hospis2_data';
const META_KEY = 'h2_meta';
const CHUNK = 3800;
const chunkKey = (gen: string, index: number) => `h2_${gen}_${index}`;

type Meta = { gen: string; count: number; savedAt: string };

const call = <T>(fn: (cb: (err: string | null, value?: T) => void) => void): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Облако Telegram не отвечает')), 8000);
    fn((err, value) => {
      window.clearTimeout(timer);
      if (err) reject(new Error(err));
      else resolve(value);
    });
  });

export const loadLocal = (): AppData | null => {
  try {
    const text = window.localStorage.getItem(LOCAL_KEY);
    return text ? parseData(JSON.parse(text)) : null;
  } catch {
    return null;
  }
};

const saveLocal = (data: AppData) => {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // переполнено — останется облако
  }
};

export const loadCloud = async (): Promise<AppData | null> => {
  const cloud = cloudStorage();
  if (!cloud) return null;
  const metaText = await call<string>((cb) => cloud.getItem(META_KEY, cb));
  if (!metaText) return null;
  const meta = JSON.parse(metaText) as Meta;
  const keys = Array.from({ length: meta.count }, (_, i) => chunkKey(meta.gen, i));
  const values = await call<Record<string, string>>((cb) => cloud.getItems(keys, cb));
  const text = keys.map((key) => values?.[key] ?? '').join('');
  return parseData(JSON.parse(text));
};

let lastGen: string | null = null;

const saveCloud = async (text: string, savedAt: string) => {
  const cloud = cloudStorage();
  if (!cloud) return;
  if (lastGen === null) {
    const metaText = await call<string>((cb) => cloud.getItem(META_KEY, cb)).catch(() => undefined);
    lastGen = metaText ? (JSON.parse(metaText) as Meta).gen : '';
  }
  const gen = Date.now().toString(36);
  const count = Math.max(1, Math.ceil(text.length / CHUNK));
  for (let i = 0; i < count; i += 1) {
    const part = text.slice(i * CHUNK, (i + 1) * CHUNK);
    await call<boolean>((cb) => cloud.setItem(chunkKey(gen, i), part, cb));
  }
  const meta: Meta = { gen, count, savedAt };
  await call<boolean>((cb) => cloud.setItem(META_KEY, JSON.stringify(meta), cb));
  // старое поколение больше не нужно
  const keys = await call<string[]>((cb) => cloud.getKeys(cb));
  const stale = (keys ?? []).filter((key) => key.startsWith('h2_') && key !== META_KEY && !key.startsWith(`h2_${gen}_`));
  if (stale.length) await call<boolean>((cb) => cloud.removeItems(stale, cb)).catch(() => undefined);
  lastGen = gen;
};

export type SaveResult = 'saved' | 'local-only';

export const saveData = async (data: AppData): Promise<SaveResult> => {
  saveLocal(data);
  if (!cloudStorage()) return 'local-only';
  try {
    await saveCloud(JSON.stringify(data), data.savedAt);
    return 'saved';
  } catch {
    return 'local-only';
  }
};

/** Берём более свежую копию: телефон или облако. */
export const loadData = async (): Promise<AppData> => {
  const local = loadLocal();
  let cloud: AppData | null = null;
  try {
    cloud = await loadCloud();
  } catch {
    cloud = null;
  }
  if (cloud && (!local || cloud.savedAt > local.savedAt)) {
    saveLocal(cloud);
    return cloud;
  }
  return local ?? cloud ?? createEmptyData();
};

export const clearAll = async () => {
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // нет доступа
  }
  const cloud = cloudStorage();
  if (!cloud) return;
  const keys = await call<string[]>((cb) => cloud.getKeys(cb)).catch(() => []);
  const ours = (keys ?? []).filter((key) => key.startsWith('h2_'));
  if (ours.length) await call<boolean>((cb) => cloud.removeItems(ours, cb)).catch(() => undefined);
  lastGen = '';
};
