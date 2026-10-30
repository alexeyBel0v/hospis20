import type { ReactNode } from 'react';
import { parseBlocks } from '../lib/content.ts';
import { callPhone } from '../lib/telegram.ts';
import { PhoneIcon } from './icons.tsx';

/** **жирный**, [заполнить] — подсветка, ссылки http — кнопки. */
const inline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|\[заполнить[^\]]*\]|https?:\/\/\S+)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith('[заполнить')) return <mark key={i}>{part.slice(1, -1)}</mark>;
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer">
          {part.replace(/^https?:\/\//, '')}
        </a>
      );
    }
    return part;
  });

export const RichText = ({ body }: { body: string }) => (
  <div className="rich">
    {parseBlocks(body).map((block, i) => {
      if (block.kind === 'p') return <p key={i}>{inline(block.text)}</p>;
      if (block.kind === 'list') {
        return (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        );
      }
      const callable = /\d{5,}/.test(block.phone.replace(/\D/g, ''));
      return (
        <button key={i} type="button" className="contact" disabled={!callable} onClick={() => callable && callPhone(block.phone)}>
          <span className="contact__text">
            <span>{block.name}</span>
            <span className="contact__sub">{[block.role, block.phone].filter(Boolean).join(', ')}</span>
          </span>
          {callable && (
            <span className="round-btn" aria-hidden="true">
              <PhoneIcon width={18} height={18} />
            </span>
          )}
        </button>
      );
    })}
  </div>
);
