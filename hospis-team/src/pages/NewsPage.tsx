import { useEffect, useState } from 'react';
import { useContent } from '../hooks/useContent.ts';
import { useData } from '../hooks/useData.tsx';
import { cn } from '../lib/cn.ts';
import { formatDayMonth } from '../lib/dates.ts';
import { ChevronDown, RefreshIcon } from '../components/icons.tsx';
import { RichText } from '../components/RichText.tsx';
import { Segmented } from '../components/ui.tsx';
import { Pamphlets } from '../components/Pamphlets.tsx';

type View = 'news' | 'info';

export const NewsPage = ({ initialView = 'news' }: { initialView?: View }) => {
  const { news, info, status, reload } = useContent();
  const { data, update } = useData();
  const [view, setView] = useState<View>(initialView);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? info.filter((s) => `${s.title}\n${s.body}`.toLowerCase().includes(q)) : info;
  const [freshIds] = useState(() => new Set(news.filter((n) => !data.settings.seenNews.includes(n.id)).map((n) => n.id)));

  // Открыли вкладку — новости прочитаны.
  useEffect(() => {
    const unseen = news.filter((n) => !data.settings.seenNews.includes(n.id));
    if (!unseen.length) return;
    unseen.forEach((n) => freshIds.add(n.id));
    update((d) => ({ ...d, settings: { ...d.settings, seenNews: [...d.settings.seenNews, ...unseen.map((n) => n.id)].slice(-200) } }));
  }, [news, data.settings.seenNews, update, freshIds]);

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="h1">{view === 'news' ? 'Новости' : 'Справка'}</h1>
        <button type="button" className={cn('icon-btn', status === 'loading' && 'spin')} aria-label="Обновить" onClick={reload}>
          <RefreshIcon />
        </button>
      </header>

      <Segmented<View>
        label="Раздел"
        value={view}
        onChange={setView}
        options={[
          { value: 'news', label: 'Новости' },
          { value: 'info', label: 'Справка' },
        ]}
      />

      {status === 'offline' && <p className="hint">Нет связи — показана сохранённая версия</p>}

      {view === 'news' &&
        (news.length ? (
          news.map((item) => (
            <article key={item.id} className={cn('news', item.important && 'news--important', freshIds.has(item.id) && 'news--fresh')}>
              <p className="news__date">
                {item.date ? formatDayMonth(item.date) : ''}
                {item.important && <span className="news__flag">важно</span>}
                {freshIds.has(item.id) && <span className="news__new">новое</span>}
              </p>
              <h2 className="news__title">{item.title}</h2>
              {item.body && <RichText body={item.body} />}
            </article>
          ))
        ) : (
          <p className="empty-line">{status === 'loading' ? 'Загрузка…' : 'Новостей пока нет'}</p>
        ))}

      {view === 'info' && !query && (
        <section className="block">
          <h2 className="block__title">Памятки для родных</h2>
          <Pamphlets />
        </section>
      )}

      {view === 'info' && info.length > 0 && (
        <input className="input" type="search" value={query} placeholder="Поиск: пролежни, Нортон, катетер…" aria-label="Поиск по справке" onChange={(e) => setQuery(e.target.value)} />
      )}

      {view === 'info' &&
        (shown.length ? (
          <div className="group">
            {shown.map((section) => {
              const open = openInfo === section.id || (q !== '' && shown.length <= 3);
              return (
                <div key={section.id} className={cn('acc', open && 'acc--open')}>
                  <button type="button" className="acc__head" aria-expanded={open} onClick={() => setOpenInfo(open ? null : section.id)}>
                    <span>{section.title}</span>
                    <ChevronDown width={18} height={18} className={cn('chev', open && 'chev--open')} />
                  </button>
                  {open && (
                    <div className="acc__body">
                      <RichText body={section.body} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-line">{status === 'loading' ? 'Загрузка…' : q ? 'Ничего не нашлось' : 'Справка пока пустая'}</p>
        ))}
    </main>
  );
};
