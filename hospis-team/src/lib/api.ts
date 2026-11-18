import type { Patient, Staff, Visit } from '../types.ts';

/** Сессия на этом телефоне: кто вошёл и его ключ. */
export type Session = { token: string; user: Staff };

const SESSION_KEY = 'hospis_session';
const STAFF_KEY = 'hospis_staff';

const readJson = <T>(key: string): T | null => {
  try {
    const text = window.localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // нет доступа к памяти телефона
  }
};

export const getSession = (): Session | null => readJson<Session>(SESSION_KEY);
export const setSession = (session: Session | null) => writeJson(SESSION_KEY, session);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const request = async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
  const session = getSession();
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Нет связи с сервером', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? 'Сервер не ответил', res.status);
  return data;
};

/** Список сотрудников для экрана входа. Без связи — последний сохранённый. */
export const fetchStaff = async (): Promise<Staff[]> => {
  try {
    const staff = await request<Staff[]>('staff');
    writeJson(STAFF_KEY, staff);
    return staff;
  } catch (error) {
    const cached = readJson<Staff[]>(STAFF_KEY);
    if (cached) return cached;
    throw error;
  }
};

export const login = async (userId: string, password: string): Promise<Session> => {
  const session = await request<Session>('login', { method: 'POST', body: { userId, password } });
  setSession(session);
  return session;
};

/** То, что сервер отдаёт сотруднику: только его пациенты (заведующей и старшей сестре — все). */
export type ServerView = {
  me: Staff;
  users: Staff[];
  patients: Patient[];
  visits: Visit[];
  deleted: string[];
  visitsDeleted: string[];
};

export type SyncChanges = { patients: Patient[]; deleted: string[]; visits: Visit[]; visitsDeleted: string[] };

export const fetchView = () => request<ServerView>('data');
export const pushChanges = (changes: SyncChanges) => request<ServerView>('sync', { method: 'POST', body: changes });

export type StaffInput = { id?: string; name?: string; role?: Staff['role']; password?: string; active?: boolean };
export const saveStaff = (input: StaffInput) => request<ServerView>('users', { method: 'POST', body: input });

/** Черновик пациента от ИИ — как он его понял. Всё проверяет человек. */
export type AiPatient = {
  fullName?: string;
  policy?: string;
  address?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  intercom?: string;
  phones?: Array<{ number?: string; who?: string }>;
  everyDays?: number | null;
  start?: string | null;
  comment?: string;
};

export const askAiPatient = (input: { text: string; image: string | null; today: string; weekday: string }) =>
  request<{ patients: AiPatient[]; model: string }>('ai/patient', { method: 'POST', body: input });

export const askAiWound = (text: string) => request<{ wound: Record<string, unknown>; model: string }>('ai/wound', { method: 'POST', body: { text } });
