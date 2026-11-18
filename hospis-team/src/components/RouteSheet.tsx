import { useEffect, useState } from 'react';
import type { Patient } from '../types.ts';
import { hasGeo, routeUrl } from '../lib/address.ts';
import { cn } from '../lib/cn.ts';
import { shortName } from '../lib/format.ts';
import { openLink } from '../lib/telegram.ts';
import { Sheet, Toggle } from './ui.tsx';

/** Маршрут на машине по адресам: порядок — стрелками, номер — пропустить точку. */
export const RouteSheet = ({ patients, onClose }: { patients: Patient[]; onClose: () => void }) => {
  const withAddress = patients.filter((p) => p.address.trim());
  const [order, setOrder] = useState(() => withAddress.map((p) => p.id));
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [fromMe, setFromMe] = useState(true);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);

  // Своё место берём с телефона заранее: тогда маршрут начнётся точно отсюда.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setOrigin(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);
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
      <div className="row-between">
        <span>От моего места</span>
        <Toggle checked={fromMe} label="От моего места" onChange={setFromMe} />
      </div>
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
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!included.length} onClick={() => openLink(routeUrl(included, origin, fromMe))}>
        Открыть в Яндекс Картах
      </button>
    </Sheet>
  );
};
