import { useState } from 'react';
import type { IsoDate, PatientInput } from '../types.ts';
import { useData } from '../hooks/useData.tsx';
import { ApiError, askAiPatient, type AiPatient } from '../lib/api.ts';
import { fromAi, shrinkImage } from '../lib/aiPatient.ts';
import { formatWeekday } from '../lib/dates.ts';
import { shortName } from '../lib/format.ts';
import { addPatient, findSame, newId } from '../lib/patients.ts';
import { haptic } from '../lib/telegram.ts';
import { Sheet } from './ui.tsx';

type Props = {
  today: IsoDate;
  current: PatientInput;
  /** Один пациент — заполняем форму, человек проверяет и сохраняет. */
  onFill: (input: PatientInput) => void;
  /** Несколько пациентов с одного листа — добавлены сразу. */
  onAddedMany: (count: number) => void;
  onClose: () => void;
};

/** «Заполнить с ИИ»: фото листа или текст → черновик карточки. Без проверки человеком ничего не сохраняется. */
export const AiSheet = ({ today, current, onFill, onAddedMany, onClose }: Props) => {
  const { data, update } = useData();
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<AiPatient[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      setImage(await shrinkImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось открыть фото');
    }
  };

  const run = async () => {
    setBusy(true);
    setError('');
    setFound(null);
    try {
      const { patients } = await askAiPatient({ text, image, today, weekday: formatWeekday(today) });
      const list = patients.filter((p) => typeof p.fullName === 'string' && p.fullName.trim());
      if (!list.length) {
        setError('ИИ не нашёл пациентов. Попробуйте фото ровнее и ближе или напишите текстом.');
      } else if (list.length === 1 && list[0]) {
        haptic('success');
        onFill(fromAi(list[0], today, current));
        onClose();
      } else {
        setFound(list);
        setPicked(new Set(list.map((_, i) => i)));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ИИ не ответил, попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };

  const addMany = () => {
    if (!found) return;
    const inputs = found.filter((_, i) => picked.has(i)).map((p) => fromAi(p, today, { ...current, fullName: '', comment: '' }));
    update((d) => inputs.reduce((acc, input) => addPatient(acc, input, newId()).data, d));
    haptic('success');
    onAddedMany(inputs.length);
    onClose();
  };

  return (
    <Sheet title="Заполнить с ИИ" onClose={onClose}>
      {!found && (
        <>
          <p className="hint">Сфотографируйте лист с пациентом или напишите как есть: «Иванова Анна, Профсоюзная 56 кв 12, дочь 8916…, раз в 3 дня с пятницы».</p>
          <label className="btn btn--soft btn--block">
            {image ? 'Другое фото' : 'Сфотографировать или выбрать фото'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          </label>
          {image && <img className="ai-photo" src={image} alt="Фото для распознавания" />}
          <textarea className="input textarea" rows={3} value={text} placeholder="Или напишите текстом" aria-label="Текст о пациенте" onChange={(e) => setText(e.target.value)} />
          {error && <p className="field__error">{error}</p>}
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={busy || (!image && !text.trim())} onClick={() => void run()}>
            {busy ? 'ИИ читает… 5–20 секунд' : 'Распознать'}
          </button>
          <p className="hint">Только тестовые данные: ИИ работает на зарубежных серверах. Всё, что он заполнил, проверьте перед сохранением.</p>
        </>
      )}

      {found && (
        <>
          <p className="hint">На фото {found.length} пациентов. Отметьте, кого добавить — потом проверьте каждого в карточке.</p>
          <div className="group">
            {found.map((p, i) => {
              const draft = fromAi(p, today);
              const exists = findSame(data.patients, { ...draft, id: '', hospital: null, geo: null, archived: false, createdAt: '', updatedAt: '' });
              return (
                <label key={i} className="line ai-pick">
                  <input
                    type="checkbox"
                    checked={picked.has(i)}
                    onChange={() =>
                      setPicked((cur) => {
                        const next = new Set(cur);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  />
                  <span className="line__text">
                    <span>{shortName(draft.fullName)}</span>
                    <span className="line__sub">{exists ? 'уже есть в базе' : draft.address || 'адрес не распознан'}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!picked.size} onClick={addMany}>
            Добавить {picked.size}
          </button>
        </>
      )}
    </Sheet>
  );
};
