import type { IsoDate, PatientInput } from '../types.ts';
import type { AiPatient } from './api.ts';
import { isIsoDate } from './dates.ts';
import { formatPhone, formatPolicy } from './masks.ts';
import { emptyInput } from './patients.ts';

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** Ответ ИИ → поля формы. Пустое и непонятное не трогаем. */
export const fromAi = (ai: AiPatient, today: IsoDate, base: PatientInput = emptyInput(today)): PatientInput => {
  const days = typeof ai.everyDays === 'number' && ai.everyDays >= 1 && ai.everyDays <= 60 ? Math.round(ai.everyDays) : null;
  const start = isIsoDate(ai.start) ? ai.start : null;
  const phones = (ai.phones ?? [])
    .map((p) => ({ number: formatPhone(s(p.number)), who: s(p.who) }))
    .filter((p) => p.number.replace(/\D/g, '').length >= 6);
  const policyDigits = s(ai.policy).replace(/\D/g, '');
  return {
    ...base,
    fullName: s(ai.fullName) || base.fullName,
    policy: policyDigits.length === 16 ? formatPolicy(policyDigits) : base.policy,
    address: s(ai.address) || base.address,
    apartment: s(ai.apartment) || base.apartment,
    entrance: s(ai.entrance) || base.entrance,
    floor: s(ai.floor) || base.floor,
    intercom: s(ai.intercom) || base.intercom,
    phones: phones.length ? phones : base.phones,
    comment: [base.comment, s(ai.comment)].filter(Boolean).join('\n'),
    schedule:
      days || start
        ? { kind: 'every', days: days ?? (base.schedule.kind === 'every' ? base.schedule.days : 3), start: start ?? (base.schedule.kind === 'every' && base.schedule.start ? base.schedule.start : today) }
        : base.schedule,
  };
};

/** Фото с телефона → JPEG до 1600 px: так быстрее отправляется и ИИ лучше читает. */
export const shrinkImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не получилось открыть фото'));
    };
    img.src = url;
  });
