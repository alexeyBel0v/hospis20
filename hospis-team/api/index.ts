/**
 * Сервер Hospis OS: вход по сотруднику и паролю, общая база пациентов, отметки визитов.
 *
 * Все данные — один JSON-документ (сотрудники, пациенты, визиты). Где он лежит, решает store():
 * на Vercel — в Vercel Blob (закрытое хранилище), локально и на своём сервере (Timeweb/Yandex) — в файле.
 * Для переезда на российский сервер достаточно запустить этот же код с DATA_FILE вместо Blob.
 */
import { createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

type Role = 'head' | 'senior' | 'doctor' | 'nurse';
type User = { id: string; name: string; role: Role; pass: string; active: boolean };
type PublicUser = { id: string; name: string; role: Role };
type Patient = { id: string; fullName: string; doctorId?: string | null; nurseId?: string | null; updatedAt: string; [key: string]: unknown };
type Visit = { id: string; patientId: string; date: string; userId: string; at: string; note: string };
type Db = { users: User[]; patients: Patient[]; deleted: string[]; visits: Visit[]; visitsDeleted: string[] };

const MANAGERS: Role[] = ['head', 'senior'];
const isManager = (u: User) => MANAGERS.includes(u.role);
const TOKEN_DAYS = 60;

// ---------- хранилище ----------

type Store = { load: () => Promise<{ db: Db | null; version: string | null }>; save: (db: Db, version: string | null) => Promise<void> };

const fileStore = (path: string): Store => ({
  load: async () => {
    try {
      return { db: JSON.parse(await readFile(path, 'utf8')) as Db, version: null };
    } catch {
      return { db: null, version: null };
    }
  },
  save: async (db) => writeFile(path, JSON.stringify(db)),
});

const BLOB_PATH = 'hospis/db.json';

const blobStore = (): Store => ({
  load: async () => {
    const { get } = await import('@vercel/blob');
    const res = await get(BLOB_PATH, { access: 'private', useCache: false });
    if (!res) return { db: null, version: null };
    const text = await new Response(res.stream).text();
    return { db: JSON.parse(text) as Db, version: res.headers.get('etag') };
  },
  save: async (db, version) => {
    const { put } = await import('@vercel/blob');
    await put(BLOB_PATH, JSON.stringify(db), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      ...(version ? { ifMatch: version } : {}),
    });
  },
});

const store = (): Store => (process.env.BLOB_READ_WRITE_TOKEN ? blobStore() : fileStore(process.env.DATA_FILE ?? './hospis-data.json'));

// ---------- пароли и вход ----------

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex')}`;
};

const checkPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const got = pbkdf2Sync(password, salt, 120_000, 32, 'sha256');
  const want = Buffer.from(hash, 'hex');
  return want.length === got.length && timingSafeEqual(got, want);
};

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.VERCEL) throw new Error('AUTH_SECRET не задан');
  return s ?? 'local-dev-secret';
};

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

const makeToken = (userId: string) => {
  const payload = `${userId}.${Date.now() + TOKEN_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload)}`;
};

const readToken = (header: string | null): string | null => {
  const token = header?.replace(/^Bearer\s+/i, '') ?? '';
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const want = sign(`${userId}.${exp}`);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
};

// ---------- тестовые данные ----------

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const seedDb = (): Db => {
  const today = iso(new Date(Date.now() + 3 * 3_600_000));
  const now = new Date().toISOString();
  const staff: [string, string, Role][] = [
    ['u-head', 'Морозова Елена Викторовна', 'head'],
    ['u-senior', 'Кузнецова Ольга Петровна', 'senior'],
    ['u-doc1', 'Григорьев Сергей Андреевич', 'doctor'],
    ['u-doc2', 'Соколова Анна Игоревна', 'doctor'],
    ['u-nurse1', 'Павлова Мария Сергеевна', 'nurse'],
    ['u-nurse2', 'Иванова Татьяна Николаевна', 'nurse'],
    ['u-nurse3', 'Смирнова Дарья Олеговна', 'nurse'],
  ];
  const users: User[] = staff.map(([id, name, role]) => ({ id, name, role, pass: hashPassword('1111'), active: true }));

  const names = [
    'Андреев Пётр Ильич', 'Борисова Нина Степановна', 'Васильев Геннадий Павлович', 'Громова Валентина Ивановна',
    'Давыдов Николай Фёдорович', 'Егорова Зинаида Михайловна', 'Жуков Виктор Андреевич', 'Зайцева Людмила Петровна',
    'Ильин Борис Сергеевич', 'Калинина Раиса Алексеевна', 'Лебедев Юрий Константинович', 'Максимова Галина Ивановна',
    'Никитин Олег Романович', 'Орлова Тамара Васильевна', 'Попов Аркадий Семёнович', 'Романова Клавдия Егоровна',
    'Семёнов Валерий Дмитриевич', 'Тарасова Антонина Павловна', 'Уваров Лев Борисович', 'Фомина Евгения Аркадьевна',
  ];
  const streets = [
    'Москва, ул. Профсоюзная, 56', 'Москва, Ленинский проспект, 123', 'Москва, ул. Вавилова, 69', 'Москва, ул. Обручева, 11',
    'Москва, ул. Гарибальди, 23', 'Москва, ул. Новаторов, 4', 'Москва, ул. Академика Варги, 8', 'Москва, ул. Островитянова, 9',
    'Москва, ул. Миклухо-Маклая, 47', 'Москва, ул. Бутлерова, 12', 'Москва, ул. Наметкина, 3', 'Москва, ул. Кржижановского, 15',
    'Москва, Севастопольский проспект, 28', 'Москва, ул. Дмитрия Ульянова, 31', 'Москва, ул. Архитектора Власова, 49', 'Москва, ул. Губкина, 6',
    'Москва, ул. Строителей, 4', 'Москва, ул. Каховка, 20', 'Москва, ул. Перекопская, 17', 'Москва, ул. Херсонская, 7',
  ];
  const every = [1, 2, 3, 3, 4, 7, 2, 3, 5, 7];
  const doctors = ['u-doc1', 'u-doc2'];
  const nurses = ['u-nurse1', 'u-nurse2', 'u-nurse3'];
  const patients: Patient[] = names.map((fullName, i) => ({
    id: `demo-${i + 1}`,
    fullName,
    policy: `7755 ${String(1000 + ((i * 7919) % 9000)).padStart(4, '0')} ${String(1000 + ((i * 3571) % 9000))} ${String(1000 + ((i * 6151) % 9000))}`,
    address: streets[i],
    apartment: String(10 + ((i * 7) % 180)),
    entrance: String(1 + (i % 6)),
    floor: String(2 + ((i * 3) % 14)),
    intercom: i % 3 === 0 ? `${10 + i}В` : '',
    phones: [
      { number: `+7 916 ${String(200 + i * 13).padStart(3, '0')}-${String(10 + i).padStart(2, '0')}-${String(40 + i).padStart(2, '0')}`, who: i % 2 ? 'Дочь' : 'Сын' },
    ],
    comment: i % 4 === 0 ? 'Тестовый пациент — данные вымышлены' : '',
    heads: ['Собака, звонить заранее', 'Ключ у соседки, кв. 14', '', 'Плохо слышит — стучать громко', '', ''][i % 6],
    schedule: { kind: 'every', days: every[i % every.length], start: addDays(today, -28 - (i % 5)) },
    catheter: i % 5 === 0 ? { type: 'urinary', size: 16 } : { type: 'none', size: null },
    oxygen: i % 7 === 0,
    allergy: i % 6 === 0 ? 'Пенициллин' : '',
    wounds: i % 8 === 0 ? 'Пролежень крестца, перевязка' : '',
    hospital: i === 13 ? { since: addDays(today, -2), note: 'ГКБ №1' } : null,
    geo: null,
    archived: false,
    doctorId: doctors[i % doctors.length],
    nurseId: nurses[i % nurses.length],
    createdAt: now,
    updatedAt: now,
  }));

  // визиты за прошлые две недели — чтобы в отчётах было что показать
  const visits: Visit[] = [];
  for (let back = 14; back >= 1; back -= 1) {
    const date = addDays(today, -back);
    patients.forEach((p, i) => {
      const s = p.schedule as { days: number; start: string };
      const diff = Math.round((Date.parse(date) - Date.parse(s.start)) / 86_400_000);
      if (diff < 0 || diff % s.days !== 0) return;
      if ((i + back) % 9 === 0) return; // иногда визит пропущен
      const who = (i + back) % 3 === 0 ? (p.doctorId as string) : (p.nurseId as string);
      visits.push({ id: randomUUID(), patientId: p.id, date, userId: who, at: `${date}T10:00:00.000Z`, note: '' });
    });
  }
  return { users, patients, deleted: [], visits, visitsDeleted: [] };
};

// ---------- правила доступа ----------

const publicUser = (u: User): PublicUser => ({ id: u.id, name: u.name, role: u.role });

const canSee = (me: User, p: Patient) => isManager(me) || p.doctorId === me.id || p.nurseId === me.id;

const view = (db: Db, me: User) => {
  const patients = db.patients.filter((p) => canSee(me, p));
  const ids = new Set(patients.map((p) => p.id));
  return {
    me: publicUser(me),
    users: db.users.filter((u) => u.active).map(publicUser),
    patients,
    visits: db.visits.filter((v) => ids.has(v.patientId)),
    deleted: db.deleted,
    visitsDeleted: db.visitsDeleted,
  };
};

type SyncBody = { patients?: Patient[]; deleted?: string[]; visits?: Visit[]; visitsDeleted?: string[] };

const applySync = (db: Db, me: User, body: SyncBody) => {
  const manager = isManager(me);
  const byId = new Map(db.patients.map((p) => [p.id, p]));

  for (const incoming of body.patients ?? []) {
    if (!incoming || typeof incoming.id !== 'string' || typeof incoming.fullName !== 'string' || !incoming.fullName.trim()) continue;
    if (db.deleted.includes(incoming.id)) continue;
    const current = byId.get(incoming.id);
    if (current && !canSee(me, current)) continue;
    if (current && current.updatedAt >= incoming.updatedAt) continue;
    const next: Patient = { ...incoming };
    if (!manager) {
      // сотрудник не может «отдать» пациента и не теряет его из виду: закрепление меняют заведующая и старшая сестра
      next.doctorId = current ? (current.doctorId ?? null) : me.role === 'doctor' ? me.id : (incoming.doctorId ?? null);
      next.nurseId = current ? (current.nurseId ?? null) : me.role === 'nurse' ? me.id : (incoming.nurseId ?? null);
    }
    byId.set(next.id, next);
  }

  for (const id of body.deleted ?? []) {
    const current = byId.get(id);
    if (!current || !manager) continue; // удалять насовсем могут только заведующая и старшая сестра
    byId.delete(id);
    db.deleted = [...new Set([...db.deleted, id])].slice(-2000);
  }
  db.patients = [...byId.values()];

  const visible = new Set(db.patients.filter((p) => canSee(me, p)).map((p) => p.id));
  const known = new Set(db.visits.map((v) => v.id));
  for (const v of body.visits ?? []) {
    if (!v || known.has(v.id) || db.visitsDeleted.includes(v.id) || !visible.has(v.patientId)) continue;
    db.visits.push({ id: v.id, patientId: v.patientId, date: String(v.date).slice(0, 10), userId: me.id, at: new Date().toISOString(), note: String(v.note ?? '').slice(0, 500) });
  }
  for (const id of body.visitsDeleted ?? []) {
    const v = db.visits.find((x) => x.id === id);
    if (!v || (v.userId !== me.id && !manager)) continue;
    db.visits = db.visits.filter((x) => x.id !== id);
    db.visitsDeleted = [...new Set([...db.visitsDeleted, id])].slice(-5000);
  }
};

// ---------- HTTP ----------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const fail = (message: string, status: number) => json({ error: message }, status);

/** Прочитать базу, изменить, записать. При одновременной записи с другого телефона — повторить. */
const transact = async <T>(change: (db: Db) => T): Promise<T> => {
  const s = store();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { db: loaded, version } = await s.load();
    const db = loaded ?? seedDb();
    const result = change(db);
    try {
      await s.save(db, version);
      return result;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  throw new Error('Не удалось сохранить');
};

const readDb = async (): Promise<Db> => {
  const { db } = await store().load();
  if (db) return db;
  return transact((fresh) => fresh);
};

const currentUser = (db: Db, req: Request): User | null => {
  const id = readToken(req.headers.get('authorization'));
  return db.users.find((u) => u.id === id && u.active) ?? null;
};

const body = async <T>(req: Request): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
};

const ROLES: Role[] = ['head', 'senior', 'doctor', 'nurse'];

export const handle = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const route = (url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/\/+$/, '');

  try {
    // Список сотрудников для экрана входа — только имена и должности.
    if (route === 'staff' && req.method === 'GET') {
      const db = await readDb();
      return json(db.users.filter((u) => u.active).map(publicUser));
    }

    if (route === 'login' && req.method === 'POST') {
      const { userId, password } = await body<{ userId?: string; password?: string }>(req);
      const db = await readDb();
      const user = db.users.find((u) => u.id === userId && u.active);
      if (!user || !password || !checkPassword(password, user.pass)) return fail('Неверный пароль', 401);
      return json({ token: makeToken(user.id), user: publicUser(user) });
    }

    if (route === 'data' && req.method === 'GET') {
      const db = await readDb();
      const me = currentUser(db, req);
      if (!me) return fail('Нужно войти заново', 401);
      return json(view(db, me));
    }

    if (route === 'sync' && req.method === 'POST') {
      const payload = await body<SyncBody>(req);
      const pre = await readDb();
      if (!currentUser(pre, req)) return fail('Нужно войти заново', 401);
      const result = await transact((db) => {
        const me = currentUser(db, req);
        if (!me) return null;
        applySync(db, me, payload);
        return view(db, me);
      });
      return result ? json(result) : fail('Нужно войти заново', 401);
    }

    // Сотрудники: добавить, изменить, сменить пароль, отключить — только заведующая и старшая сестра.
    // Свой пароль может сменить каждый.
    if (route === 'users' && req.method === 'POST') {
      const input = await body<{ id?: string; name?: string; role?: Role; password?: string; active?: boolean }>(req);
      const pre = await readDb();
      const me = currentUser(pre, req);
      if (!me) return fail('Нужно войти заново', 401);
      const self = input.id === me.id;
      if (!isManager(me) && !(self && input.password && !input.name && !input.role && input.active === undefined)) return fail('Нет прав', 403);
      if (input.password !== undefined && input.password.trim().length < 4) return fail('Пароль — минимум 4 символа', 400);
      if (input.role !== undefined && !ROLES.includes(input.role)) return fail('Неизвестная должность', 400);
      const error = await transact((db) => {
        const existing = input.id ? db.users.find((u) => u.id === input.id) : undefined;
        if (input.id && !existing) return 'Сотрудник не найден';
        if (existing) {
          if (input.name?.trim()) existing.name = input.name.trim();
          if (input.role) existing.role = input.role;
          if (input.password) existing.pass = hashPassword(input.password.trim());
          if (input.active !== undefined && existing.id !== me.id) existing.active = input.active;
          return null;
        }
        if (!input.name?.trim() || !input.role || !input.password) return 'Нужны ФИО, должность и пароль';
        db.users.push({ id: randomUUID(), name: input.name.trim(), role: input.role, pass: hashPassword(input.password.trim()), active: true });
        return null;
      });
      if (error) return fail(error, 400);
      const db = await readDb();
      return json(view(db, currentUser(db, req) as User));
    }

    return fail('Не найдено', 404);
  } catch (error) {
    console.error(error);
    return fail('Сервер не ответил, попробуйте ещё раз', 500);
  }
};

export const GET = handle;
export const POST = handle;
