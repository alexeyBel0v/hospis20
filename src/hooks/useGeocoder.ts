import { useEffect, useRef } from 'react';
import { useData } from './useData.tsx';
import { geocode } from '../lib/geocode.ts';
import { setGeo } from '../lib/patients.ts';

/** В фоне находит на карте адреса, которые ещё не искали (по одному в секунду — правило OpenStreetMap). */
export const useGeocoder = () => {
  const { data, update } = useData();
  const busy = useRef(false);
  const pending = data.patients.filter((p) => !p.archived && p.address.trim() && (!p.geo || p.geo.for !== p.address));
  const key = pending.map((p) => `${p.id}:${p.address}`).join('|');

  useEffect(() => {
    if (!pending.length || busy.current) return;
    busy.current = true;
    let alive = true;
    void (async () => {
      for (const patient of pending) {
        await new Promise((r) => setTimeout(r, 1100));
        if (!alive) break;
        const geo = await geocode(patient.address);
        if (!geo) break; // нет связи — попробуем при следующем изменении
        update((d) => setGeo(d, patient.id, geo));
      }
      busy.current = false;
    })();
    return () => {
      alive = false;
      busy.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
