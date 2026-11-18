import { useEffect, useState } from 'react';
import { haptic, sharePdf } from '../lib/telegram.ts';
import { DownloadIcon } from './icons.tsx';

type Pamphlet = { id: string; title: string };

/** Памятки для родных: PDF, который можно переслать в Telegram, WhatsApp или распечатать. */
export const Pamphlets = () => {
  const [list, setList] = useState<Pamphlet[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('./pamyatki/list.json', { cache: 'no-store' })
      .then((r) => r.json() as Promise<Pamphlet[]>)
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (!list.length) return null;

  const send = async (p: Pamphlet) => {
    haptic();
    setBusy(p.id);
    setNote('');
    const result = await sharePdf(`./pamyatki/${p.id}.pdf`, `${p.title}.pdf`, p.title);
    setBusy(null);
    if (result === 'failed') setNote('Не получилось отправить. Откройте памятку и сохраните её вручную.');
  };

  return (
    <div className="pamphlets">
      <div className="group">
        {list.map((p) => (
          <button key={p.id} type="button" className="line" disabled={busy === p.id} onClick={() => void send(p)}>
            <span className="line__text">
              <span>{p.title}</span>
              <span className="line__sub">PDF, одна страница</span>
            </span>
            <span className="round-btn" aria-hidden="true">
              <DownloadIcon width={18} height={18} />
            </span>
          </button>
        ))}
      </div>
      <p className="hint">Нажмите, чтобы отправить родным или сохранить. Внизу памятки есть строки, чтобы от руки вписать телефон службы и медсестры.</p>
      {note && <p className="field__error">{note}</p>}
    </div>
  );
};
