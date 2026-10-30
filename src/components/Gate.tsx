import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { checkPassword, isUnlocked, isUnlockedInCloud, rememberUnlock } from '../lib/password.ts';
import { haptic } from '../lib/telegram.ts';
import { cn } from '../lib/cn.ts';

const SPLASH_MS = 1500;

export const Logo = ({ size = 72 }: { size?: number }) => (
  <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="19" fill="var(--accent)" />
    <path className="logo__pulse" d="M9 33h11l5-11 7 20 5-13h18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Заставка → пароль (один раз на телефоне) → приложение. */
export const Gate = ({ children }: { children: ReactNode }) => {
  const [phase, setPhase] = useState<'splash' | 'lock' | 'open'>('splash');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    const decide = async () => {
      const unlocked = isUnlocked() || (await isUnlockedInCloud());
      if (unlocked) rememberUnlock();
      const wait = Math.max(0, SPLASH_MS - (Date.now() - started));
      window.setTimeout(() => alive && setPhase(unlocked ? 'open' : 'lock'), wait);
    };
    void decide();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (phase === 'lock') window.setTimeout(() => input.current?.focus(), 300);
  }, [phase]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await checkPassword(password)) {
      haptic('success');
      rememberUnlock();
      setPhase('open');
      return;
    }
    haptic('error');
    setError('Неверный пароль');
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };

  if (phase === 'open') return <>{children}</>;

  return (
    <main className="gate">
      <div className={cn('gate__brand', phase === 'lock' && 'gate__brand--up')}>
        <Logo size={phase === 'lock' ? 64 : 84} />
        <p className="gate__name">Hospis OS</p>
        {phase === 'splash' && <span className="gate__bar" aria-label="Загрузка" />}
      </div>
      {phase === 'lock' && (
        <form className={cn('gate__form', shake && 'shake')} onSubmit={submit}>
          <label className="field__label" htmlFor="password">
            Пароль
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
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!password.trim()}>
            Войти
          </button>
        </form>
      )}
    </main>
  );
};
