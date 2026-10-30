import { useEffect, useState } from 'react';
import { todayIso } from '../lib/dates.ts';

/** Сегодняшняя дата; обновляется после полуночи и при возврате в приложение. */
export const useToday = (): string => {
  const [today, setToday] = useState(todayIso);
  useEffect(() => {
    const refresh = () => setToday(todayIso());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
};
