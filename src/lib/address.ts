import type { Patient } from '../types.ts';

export const ADDRESS_HINT = 'Город, улица, дом. Квартира и подъезд — ниже.';

export const normalizeAddress = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '');

const APARTMENT = /,?\s*(?:кв\.?|квартира)\s*(\d+[а-яa-z]?)\s*$/i;
const STREET_FIRST = /^(ул\.?|улица|пр-т|просп|проспект|пер\.?|переулок|ш\.|шоссе|б-р|бул|наб|проезд|пл\.|площадь|мкр)(\s|\.|$)/i;

/** «ул. Ленина, 15, кв. 4» → { address: «ул. Ленина, 15», apartment: «4» } */
export const splitApartment = (address: string): { address: string; apartment: string } => {
  const match = APARTMENT.exec(address);
  if (!match) return { address: normalizeAddress(address), apartment: '' };
  return { address: normalizeAddress(address.slice(0, match.index)), apartment: match[1] ?? '' };
};

/** Подсказка, если адрес записан так, что маршрут может не найтись. */
export const addressWarning = (address: string): string => {
  const value = address.trim();
  if (!value) return '';
  if (APARTMENT.test(value)) return 'Квартиру — в поле «Кв.»';
  if (!/\d/.test(value)) return 'Не хватает номера дома';
  if (STREET_FIRST.test(value)) return 'Добавьте город в начало: «Москва, …»';
  return '';
};

/** «кв. 4, подъезд 2, этаж 3, домофон 45К» */
export const addressDetails = (p: Pick<Patient, 'apartment' | 'entrance' | 'floor' | 'intercom'>): string =>
  [p.apartment && `кв. ${p.apartment}`, p.entrance && `подъезд ${p.entrance}`, p.floor && `этаж ${p.floor}`, p.intercom && `домофон ${p.intercom}`]
    .filter(Boolean)
    .join(', ');

/** Один адрес: открывается карточка дома в Яндекс Картах, там кнопка «Маршрут». Работает и в приложении, и в браузере. */
export const placeUrl = (address: string): string => `https://yandex.ru/maps/?text=${encodeURIComponent(address.trim())}`;

type RoutePoint = Pick<Patient, 'address' | 'geo'>;

/** Точка для Яндекса: координаты, если адрес найден на карте, иначе сам адрес текстом. */
const pointOf = (p: RoutePoint): string =>
  p.geo && p.geo.for === p.address && p.geo.lat !== null && p.geo.lon !== null ? `${p.geo.lat.toFixed(6)},${p.geo.lon.toFixed(6)}` : p.address.trim();

/**
 * Маршрут на машине через все точки по порядку.
 * Начало: моё место по координатам телефона; если их нет — пустая точка (Яндекс подставит «Моё местоположение»).
 */
export const routeUrl = (patients: RoutePoint[], origin: { lat: number; lon: number } | null, fromMe = true): string => {
  const points = patients.filter((p) => p.address.trim()).map(pointOf);
  const start = fromMe ? [origin ? `${origin.lat.toFixed(6)},${origin.lon.toFixed(6)}` : ''] : [];
  const rtext = [...start, ...points].map((p) => encodeURIComponent(p).replace(/%2C/g, ',')).join('~');
  return `https://yandex.ru/maps/?rtext=${rtext}&rtt=auto`;
};

export const hasGeo = (p: RoutePoint): boolean => Boolean(p.geo && p.geo.for === p.address && p.geo.lat !== null);
