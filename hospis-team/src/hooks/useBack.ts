import { useEffect, useRef } from 'react';
import { pushBack } from '../lib/telegram.ts';

/** Пока компонент на экране — кнопка «Назад» Telegram вызывает handler. */
export const useBack = (handler: (() => void) | null) => {
  const ref = useRef(handler);
  ref.current = handler;
  const active = handler !== null;
  useEffect(() => {
    if (!active) return undefined;
    return pushBack(() => ref.current?.());
  }, [active]);
};
