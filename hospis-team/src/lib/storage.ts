import type { AppData, Patient, Settings, Shifts, Staff, Visit } from '../types.ts';
import { createEmptyData, parseData } from './data.ts';
import { ApiError, fetchView, getSession, pushChanges, type ServerView, type SyncChanges } from './api.ts';

/**
 * Где лежат данные:
 * 1) на сервере — общая база отделения (пациенты, отметки визитов, сотрудники);
 * 2) на телефоне — копия последнего ответа сервера и несохранённые правки: приложение открывается мгновенно и
 *    работает без связи, правки уйдут на сервер, когда связь появится;
 * 3) свои смены и тема — только на телефоне, у каждого сотрудника свои.
 */

type Local = { data: AppData; server: ServerView | null };

const key = (userId: string) => `hospis3_${userId}`;

export const loadLocal = (): Local | null => {
  const session = getSession();
  if (!session) return null;
  try {
    const text = window.localStorage.getItem(key(session.user.id));
    if (!text) return null;
    const raw = JSON.parse(text) as { data: unknown; server: ServerView | null };
    return { data: parseData(raw.data), server: raw.server };
  } catch {
    return null;
  }
};

const saveLocal = (local: Local) => {
  const session = getSession();
  if (!session) return;
  try {
    window.localStorage.setItem(key(session.user.id), JSON.stringify(local));
  } catch {
    // переполнено
  }
};

export const forgetLocal = (userId: string) => {
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    // нет доступа
  }
};

/** Что изменилось на телефоне по сравнению с последним ответом сервера. */
export const diff = (data: AppData, server: ServerView | null): SyncChanges => {
  const known = new Map((server?.patients ?? []).map((p) => [p.id, JSON.stringify(p)]));
  const knownVisits = new Set((server?.visits ?? []).map((v) => v.id));
  const goneVisits = new Set(server?.visitsDeleted ?? []);
  const gone = new Set(server?.deleted ?? []);
  return {
    patients: data.patients.filter((p) => known.get(p.id) !== JSON.stringify(p)),
    deleted: data.deleted.filter((id) => !gone.has(id) && known.has(id)),
    visits: data.visits.filter((v) => !knownVisits.has(v.id) && !goneVisits.has(v.id)),
    visitsDeleted: data.visitsDeleted.filter((id) => knownVisits.has(id)),
  };
};

export const hasChanges = (c: SyncChanges) => c.patients.length + c.deleted.length + c.visits.length + c.visitsDeleted.length > 0;

/** Данные приложения = ответ сервера + свои смены и настройки с телефона. */
export const fromServer = (view: ServerView, shifts: Shifts, settings: Settings): AppData => ({
  ...createEmptyData(),
  patients: view.patients as Patient[],
  visits: view.visits as Visit[],
  deleted: view.deleted,
  visitsDeleted: view.visitsDeleted,
  shifts,
  settings,
  savedAt: new Date().toISOString(),
});

export type SyncResult = { data: AppData; server: ServerView | null; state: 'saved' | 'offline' | 'logout' };

/** Отправить правки и получить свежую картину с сервера. */
export const sync = async (data: AppData, server: ServerView | null): Promise<SyncResult> => {
  const changes = diff(data, server);
  try {
    const view = hasChanges(changes) || !server ? await pushOrFetch(changes) : await fetchView();
    const next = fromServer(view, data.shifts, data.settings);
    saveLocal({ data: next, server: view });
    return { data: next, server: view, state: 'saved' };
  } catch (error) {
    saveLocal({ data, server });
    if (error instanceof ApiError && error.status === 401) return { data, server, state: 'logout' };
    return { data, server, state: 'offline' };
  }
};

const pushOrFetch = (changes: SyncChanges) => (hasChanges(changes) ? pushChanges(changes) : fetchView());

export const keepLocal = (data: AppData, server: ServerView | null) => saveLocal({ data, server });

export const staffName = (users: Staff[], id: string | null) => users.find((u) => u.id === id)?.name ?? '';
