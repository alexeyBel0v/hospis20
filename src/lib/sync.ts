import type { AppData, Patient } from '../types.ts';

const newer = (a: Patient, b: Patient): Patient => (b.updatedAt > a.updatedAt ? b : a);

/**
 * Склеить две копии данных (телефон и компьютер, или телефон и облако).
 * Пациенты: объединяются по id, у совпавших берётся более свежая правка; удалённые где-либо — удаляются везде.
 * Смены — из более свежей копии. Ничего не теряется, если на двух устройствах добавили разных пациентов.
 */
export const mergeData = (mine: AppData, theirs: AppData): AppData => {
  const deleted = [...new Set([...mine.deleted, ...theirs.deleted])].slice(-1000);
  const gone = new Set(deleted);
  const byId = new Map<string, Patient>();
  for (const p of [...mine.patients, ...theirs.patients]) {
    if (gone.has(p.id)) continue;
    const current = byId.get(p.id);
    byId.set(p.id, current ? newer(current, p) : p);
  }
  const fresher = theirs.savedAt > mine.savedAt ? theirs : mine;
  return {
    ...mine,
    patients: [...byId.values()],
    shifts: fresher.shifts,
    settings: { ...mine.settings, seenNews: [...new Set([...mine.settings.seenNews, ...theirs.settings.seenNews])].slice(-200) },
    deleted,
    savedAt: mine.savedAt > theirs.savedAt ? mine.savedAt : theirs.savedAt,
  };
};

/** Есть ли в копии theirs что-то, чего нет в mine. */
export const differs = (mine: AppData, theirs: AppData): boolean => JSON.stringify(mergeData(mine, theirs).patients) !== JSON.stringify(mine.patients) || mine.savedAt < theirs.savedAt;
