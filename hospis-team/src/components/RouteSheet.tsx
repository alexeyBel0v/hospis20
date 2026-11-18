import { useEffect, useState } from 'react';
import type { Patient } from '../types.ts';
import { hasGeo, routeUrl } from '../lib/address.ts';
import { cn } from '../lib/cn.ts';
import { shortName } from '../lib/format.ts';
import { openLink } from '../lib/telegram.ts';
import { Segmented, Sheet } from './ui.tsx';
import { BASE } from '../config.ts';
import { geocode } from '../lib/geocode.ts';

const BASE_KEY = 'hospis_base_geo';

/** Координаты базы ищем один раз и запоминаем на телефоне. */
const loadBase = (): string | null => {
  try {
    return window.localStorage.getItem(BASE_KEY);
  } catch {
    return null;
  }
};

/** Маршрут на машине по адресам: порядок — стрелками, номер — пропустить точку. */
export const RouteSheet = ({ patients, onClose }: { patients: Patient[]; onClose: () => void }) => {
  const withAddress = patients.filter((p) => p.address.trim());
  const [order, setOrder] = useState(() => withAddress.map((p) => p.id));
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [from, setFrom] = useState<'base' | 'me'>('base');
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [base, setBase] = useState<string | null>(loadBase);

  useEffect(() => {
    if (base) return;
    void geocode(BASE.address).then((geo) => {
      if (!geo || geo.lat === null || geo.lon === null) return;
      const point = `${geo.lat.toFixed(6)},${geo.lon.toFixed(6)}`;
      setBase(point);
      try {
        window.localStorage.setItem(BASE_KEY, point);
      } catch {
        // нет доступа к памяти
      }
    });
  }, [base]);

  // Своё место берём с телефона заранее: тогда маршрут начнётся точно отсюда.
  useEffect(() => {
    if (from !== 'me' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setOrigin(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [from]);
  const start = from === 'base' ? (base ?? BASE.address) : origin ? `${origin.lat.toFixed(6)},${origin.lon.toFixed(6)}` : '';
  const byId = new Map(withAddress.map((p) => [p.id, p]));
  const ordered = order.map((id) => byId.get(id)).filter((p): p is Patient => Boolean(p));
  const included = ordered.filter((p) => !skipped.has(p.id));

  const move = (index: number, delta: number) => {
    const next = [...order];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + delta, 0, item);
    setOrder(next);
  };

  const toggle = (id: string) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Sheet title="Маршрут" onClose={onClose}>
      <Segmented<'base' | 'me'>
        label="Откуда"
        value={from}
        onChange={setFrom}
        options={[
          { value: 'base', label: 'От базы' },
          { value: 'me', label: 'От меня' },
        ]}
      />
      <p className="hint">{from === 'base' ? `Начало: ${BASE.label}` : 'Начало: где вы сейчас'}</p>
      <div className="group">
        {ordered.map((p, index) => {
          const off = skipped.has(p.id);
          return (
            <div key={p.id} className={cn('route-row', off && 'route-row--off')}>
              <button type="button" className="route-row__num" aria-label={off ? 'Включить' : 'Пропустить'} onClick={() => toggle(p.id)}>
                {off ? '–' : included.indexOf(p) + 1}
              </button>
              <span className="route-row__text">
                <span className="route-row__name">{shortName(p.fullName)}</span>
                <span className="route-row__sub">{p.address}</span>
                {!hasGeo(p) && <span className="route-row__warn">{p.geo ? 'не найден на карте' : 'ищу на карте…'}</span>}
              </span>
              <button type="button" className="icon-btn icon-btn--ghost" aria-label="Выше" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button type="button" className="icon-btn icon-btn--ghost" aria-label="Ниже" disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>
                ↓
              </button>
            </div>
          );
        })}
      </div>
      {patients.length > withAddress.length && <p className="hint">Без адреса: {patients.length - withAddress.length}</p>}
      {included.some((p) => p.geo?.for === p.address && p.geo.lat === null) && <p className="hint">Адреса, не найденные на карте, Яндекс может не понять. Проверьте их написание в карточке.</p>}
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!included.length} onClick={() => openLink(routeUrl(included, start))}>
        Открыть в Яндекс Картах
      </button>
    </Sheet>
  );
};
