/** Календарная дата без времени: YYYY-MM-DD. */
export type IsoDate = string;

export type Phone = { number: string; who: string };

/** График визитов: каждые N дней от даты первого визита — или свои даты. */
export type Schedule = { kind: 'every'; days: number; start: IsoDate } | { kind: 'dates'; dates: IsoDate[] };

export type CatheterType = 'none' | 'urinary' | 'cysto' | 'other';

/** Точка на карте для адреса `for`. lat = null — адрес не нашёлся. */
export type Geo = { for: string; lat: number | null; lon: number | null };

export type Patient = {
  id: string;
  fullName: string;
  policy: string;
  /** Город, улица, дом — по этой строке строится маршрут. */
  address: string;
  apartment: string;
  entrance: string;
  floor: string;
  intercom: string;
  phones: Phone[];
  comment: string;
  schedule: Schedule;
  catheter: { type: CatheterType; size: number | null };
  oxygen: boolean;
  /** Пусто — аллергии нет. */
  allergy: string;
  /** Раны, пролежни — свободным текстом. */
  wounds: string;
  /** В больнице: визиты на паузе. */
  hospital: { since: IsoDate; note: string } | null;
  /** Координаты адреса — для маршрута через несколько точек. */
  geo: Geo | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PatientInput = Omit<Patient, 'id' | 'hospital' | 'geo' | 'archived' | 'createdAt' | 'updatedAt'>;

export type ShiftMark = 'work' | 'off';

export type Shifts = {
  /** Работаю N дней, отдыхаю M дней, начиная с даты. work = 0 — графика нет, только ручные отметки. */
  work: number;
  off: number;
  start: IsoDate;
  /** «08:00–20:00» */
  hours: string;
  /** Ручные исправления: подменился, взял выходной. */
  overrides: Record<IsoDate, ShiftMark>;
};

export type ThemeChoice = 'auto' | 'light' | 'dark';

export type Settings = {
  theme: ThemeChoice;
  /** Какие новости уже видели (id). */
  seenNews: string[];
};

export type AppData = {
  version: 2;
  patients: Patient[];
  shifts: Shifts;
  settings: Settings;
  /** id удалённых пациентов — чтобы они не «воскресали» при синхронизации телефона и компьютера. */
  deleted: string[];
  savedAt: string;
};
