import type { IsoDate } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { cn } from '../lib/cn.ts';
import { shortName } from '../lib/format.ts';
import { toggleVisit } from '../lib/patients.ts';
import { haptic } from '../lib/telegram.ts';
import { CheckIcon } from './icons.tsx';

/** Кто уже был у пациента в этот день (не считая меня). */
export const useVisitInfo = (patientId: string, date: IsoDate) => {
  const { data, me, users } = useData();
  const day = data.visits.filter((v) => v.patientId === patientId && v.date === date);
  const mine = day.some((v) => v.userId === me.id);
  const others = day.filter((v) => v.userId !== me.id).map((v) => shortName(users.find((u) => u.id === v.userId)?.name ?? 'Сотрудник'));
  return { mine, others, any: day.length > 0 };
};

/** «Был» — одно касание. Повторное касание снимает отметку. */
export const VisitButton = ({ patientId, date, size = 'md' }: { patientId: string; date: IsoDate; size?: 'md' | 'lg' }) => {
  const { update, me } = useData();
  const { mine, others } = useVisitInfo(patientId, date);
  return (
    <div className="visit">
      <button
        type="button"
        className={cn('btn btn--block', size === 'lg' && 'btn--lg', mine ? 'btn--done' : 'btn--primary')}
        aria-pressed={mine}
        onClick={() => {
          haptic(mine ? 'tap' : 'success');
          update((d) => toggleVisit(d, patientId, date, me.id));
        }}
      >
        <CheckIcon width={20} height={20} />
        {mine ? 'Был — отметка стоит' : 'Отметить: был'}
      </button>
      {others.length > 0 && <p className="hint hint--center">Уже был: {others.join(', ')}</p>}
    </div>
  );
};
