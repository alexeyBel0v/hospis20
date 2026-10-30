import type { Geo } from '../types.ts';

/**
 * Поиск координат адреса через OpenStreetMap (бесплатно, без ключа).
 * Уходит только строка адреса — без ФИО, полиса и телефонов.
 * Нужно, чтобы Яндекс Карты построили маршрут через несколько точек: по документации они принимают только координаты.
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const query = async (text: string): Promise<{ lat: number; lon: number } | null> => {
  const url = `${ENDPOINT}?format=jsonv2&limit=1&countrycodes=ru&accept-language=ru&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`geocode ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.length) return null;
  const first = body[0] as { lat?: string; lon?: string };
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

/** «104к2», «15 корп. 2», «7с1» → только номер дома: OpenStreetMap лучше находит так. */
const simplify = (address: string): string =>
  address
    .replace(/(\d+)\s*(к|корп\.?|корпус|с|стр\.?|строение)\s*\d+/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** null — нет связи (попробуем позже); Geo с lat = null — адрес не найден. */
export const geocode = async (address: string): Promise<Geo | null> => {
  try {
    const exact = await query(address);
    if (exact) return { for: address, ...exact };
    const loose = simplify(address);
    if (loose !== address) {
      await new Promise((r) => setTimeout(r, 1100));
      const found = await query(loose);
      if (found) return { for: address, ...found };
    }
    return { for: address, lat: null, lon: null };
  } catch {
    return null;
  }
};
