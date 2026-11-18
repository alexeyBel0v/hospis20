import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Role, Staff } from '../types.ts';
import { ApiError, fetchStaff, getSession, login } from '../lib/api.ts';
import { roleName } from '../lib/format.ts';
import { haptic } from '../lib/telegram.ts';
import { cn } from '../lib/cn.ts';
import { ChevronLeft, ChevronRight } from './icons.tsx';

const SPLASH_MS = 1200;

export const Logo = ({ size = 72 }: { size?: number }) => (
  <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="20" fill="var(--accent)" />
    <path className="logo__pulse" d="M9 33h11l5-11 7 20 5-13h18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GROUPS: Array<{ title: string; roles: Role[] }> = [
  { title: 'Руководство', roles: ['head', 'senior'] },
  { title: 'Врачи', roles: ['doctor'] },
  { title: 'Медсёстры', roles: ['nurse'] },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('');

/** Заставка → выбор сотрудника → его пароль → приложение. Выход возвращает к выбору сотрудника. */
export const Gate = ({ children }: { children: (onLogout: () => void) => ReactNode }) => {
  const [phase, setPhase] = useState<'splash' | 'pick' | 'open'>('splash');
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [chosen, setChosen] = useState<Staff | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const loadStaff = () => {
    setLoadError('');
    fetchStaff()
      .then(setStaff)
      .catch((e: unknown) => setLoadError(e instanceof ApiError ? e.message : 'Нет связи с сервером'));
  };

  useEffect(() => {
    const signedIn = Boolean(getSession());
    const t = window.setTimeout(() => setPhase(signedIn ? 'open' : 'pick'), signedIn ? 500 : SPLASH_MS);
    if (!signedIn) loadStaff();
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (chosen) window.setTimeout(() => input.current?.focus(), 250);
  }, [chosen]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) return;
    setBusy(true);
    try {
      await login(chosen.id, password.trim());
      haptic('success');
      setPassword('');
      setChosen(null);
      setPhase('open');
    } catch (e) {
      haptic('error');
      setError(e instanceof ApiError ? e.message : 'Не получилось войти');
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = () => {
    setPhase('pick');
    loadStaff();
  };

  if (phase === 'open') return <>{children(onLogout)}</>;

  return (
    <main className="gate">
      <div className={cn('gate__brand', phase === 'pick' && 'gate__brand--up')}>
        <Logo size={phase === 'pick' ? 56 : 84} />
        <p className="gate__name">Hospis OS</p>
        {phase === 'splash' && <span className="gate__bar" aria-label="Загрузка" />}
      </div>

      {phase === 'pick' && !chosen && (
        <div className="gate__pick">
          <h1 className="gate__title">Кто вы?</h1>
          {loadError && (
            <div className="gate__error">
              <p className="field__error">{loadError}</p>
              <button type="button" className="btn btn--soft btn--block" onClick={loadStaff}>
                Попробовать ещё раз
              </button>
            </div>
          )}
          {!staff && !loadError && <p className="hint hint--center">Загружаю список сотрудников…</p>}
          {staff &&
            GROUPS.map((group) => {
              const people = staff.filter((s) => group.roles.includes(s.role));
              if (!people.length) return null;
              return (
                <section key={group.title} className="block">
                  <h2 className="block__title">{group.title}</h2>
                  <div className="group">
                    {people.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        className="line person"
                        onClick={() => {
                          haptic();
                          setError('');
                          setChosen(person);
                        }}
                      >
                        <span className={cn('avatar', `avatar--${person.role}`)} aria-hidden="true">
                          {initials(person.name)}
                        </span>
                        <span className="line__text">
                          <span>{person.name}</span>
                          <span className="line__sub">{roleName(person.role)}</span>
                        </span>
                        <ChevronRight width={18} height={18} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      )}

      {phase === 'pick' && chosen && (
        <form className={cn('gate__form', shake && 'shake')} onSubmit={submit}>
          <button type="button" className="back" onClick={() => setChosen(null)}>
            <ChevronLeft width={20} height={20} />
            Другой сотрудник
          </button>
          <div className="gate__who">
            <span className={cn('avatar avatar--lg', `avatar--${chosen.role}`)} aria-hidden="true">
              {initials(chosen.name)}
            </span>
            <p className="gate__who-name">{chosen.name}</p>
            <p className="line__sub">{roleName(chosen.role)}</p>
          </div>
          <label className="field__label" htmlFor="password">
            Ваш пароль
          </label>
          <input
            ref={input}
            id="password"
            className={cn('input input--lg', error && 'input--error')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
          {error && <p className="field__error">{error}</p>}
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!password.trim() || busy}>
            {busy ? 'Вхожу…' : 'Войти'}
          </button>
        </form>
      )}
    </main>
  );
};
