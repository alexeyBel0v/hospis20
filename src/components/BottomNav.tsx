import { cn } from '../lib/cn.ts';
import { haptic } from '../lib/telegram.ts';
import { CalendarIcon, HomeIcon, NewsIcon, PeopleIcon } from './icons.tsx';

export type Tab = 'today' | 'patients' | 'schedule' | 'news';

const TABS: Array<{ id: Tab; label: string; Icon: typeof HomeIcon }> = [
  { id: 'today', label: 'Сегодня', Icon: HomeIcon },
  { id: 'patients', label: 'Пациенты', Icon: PeopleIcon },
  { id: 'schedule', label: 'График', Icon: CalendarIcon },
  { id: 'news', label: 'Новости', Icon: NewsIcon },
];

export const BottomNav = ({ active, onChange, newsBadge }: { active: Tab; onChange: (tab: Tab) => void; newsBadge: number }) => (
  <nav className="nav" aria-label="Разделы">
    {TABS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        className={cn('nav__item', active === id && 'nav__item--on')}
        aria-current={active === id ? 'page' : undefined}
        onClick={() => {
          haptic();
          onChange(id);
        }}
      >
        <span className="nav__icon">
          <Icon />
          {id === 'news' && newsBadge > 0 && <span className="nav__badge">{newsBadge}</span>}
        </span>
        <span>{label}</span>
      </button>
    ))}
  </nav>
);
