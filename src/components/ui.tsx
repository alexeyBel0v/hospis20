import { useEffect, type ReactNode } from 'react';
import { useBack } from '../hooks/useBack.ts';
import { cn } from '../lib/cn.ts';
import { CloseIcon } from './icons.tsx';

type SegOption<T extends string> = { value: T; label: ReactNode };

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<SegOption<T>>;
  onChange: (v: T) => void;
  label: string;
}) => (
  <div className="seg" role="tablist" aria-label={label}>
    {options.map((o) => (
      <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={cn('seg__btn', o.value === value && 'seg__btn--on')} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />
);

export const Field = ({ label, htmlFor, hint, error, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string; children: ReactNode }) => (
  <div className="field">
    <label className="field__label" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
  </div>
);

/** Шторка снизу. Закрывается кнопкой, тапом по фону и «Назад» в Telegram. */
export const Sheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  useBack(onClose);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet">
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="icon-btn icon-btn--ghost" aria-label="Закрыть" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
};
