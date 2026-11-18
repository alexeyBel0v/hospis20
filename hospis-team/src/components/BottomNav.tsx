import { cn } from '../lib/cn.ts';
import { haptic } from '../lib/telegram.ts';
import { CalendarIcon, ChartIcon, HomeIcon, NewsIcon, PeopleIcon } from './icons.tsx';

export type Tab = 'today' | 'patients' | 'schedule' | 'report' | 'news';

type TabDef = { id: Tab; label: string; Icon: typeof HomeIcon };

const STAFF_TABS: TabDef[] = [
  { id: 'today', label: 'Сегодня', Icon: HomeIcon },
  { id: 'patients', label: 'Пациенты', Icon: PeopleIcon },
  { id: 'schedule', label: 'График', Icon: CalendarIcon },
  { id: 'news', label: 'Новости', Icon: NewsIcon },
];

/** Заведующей и старшей сестре вместо своих смен — отчёт. */
const MANAGER_TABS: TabDef[] = [
  { id: 'today', label: 'Сегодня', Icon: HomeIcon },
  { id: 'patients', label: 'Пациенты', Icon: PeopleIcon },
  { id: 'report', label: 'Отчёт', Icon: ChartIcon },
  { id: 'news', label: 'Новости', Icon: NewsIcon },
];

export const BottomNav = ({ active, onChange, newsBadge, manager }: { active: Tab; onChange: (tab: Tab) => void; newsBadge: number; manager: boolean }) => (
  <nav className="nav" aria-label="Разделы">
    {(manager ? MANAGER_TABS : STAFF_TABS).map(({ id, label, Icon }) => (
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
