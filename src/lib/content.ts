import type { IsoDate } from '../types.ts';
import { parseDots } from './dates.ts';

export type NewsItem = { id: string; date: IsoDate | null; title: string; important: boolean; body: string };
export type InfoSection = { id: string; title: string; body: string };

/** Делит markdown на блоки «## Заголовок»; всё до первого заголовка — инструкция, не показываем. */
const splitSections = (text: string): Array<{ heading: string; body: string }> => {
  const sections: Array<{ heading: string; body: string }> = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });
      current = { heading: (heading[1] ?? '').trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });
  return sections;
};

const slug = (text: string): string => {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
};

/** «30.10.2026 ! Заголовок» → дата, важность, заголовок. Новые — сверху. */
export const parseNews = (text: string): NewsItem[] =>
  splitSections(text)
    .map(({ heading, body }) => {
      const match = /^(\d{1,2}\.\d{1,2}\.\d{4})\s*(!)?\s*(.*)$/.exec(heading);
      const date = match ? parseDots(match[1] ?? '') : null;
      const important = Boolean(match?.[2]) || heading.startsWith('!');
      const title = (match ? match[3] ?? '' : heading.replace(/^!\s*/, '')).trim() || 'Без заголовка';
      return { id: slug(heading + body.slice(0, 40)), date, title, important, body };
    })
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

export const parseInfo = (text: string): InfoSection[] =>
  splitSections(text).map(({ heading, body }) => ({ id: slug(heading), title: heading, body }));

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'contact'; name: string; role: string; phone: string };

/** Простая разметка: абзацы, списки «- », строки контактов «| Имя | Должность | телефон». */
export const parseBlocks = (body: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') });
    if (list.length) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    list = [];
  };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      const [name = '', role = '', phone = ''] = line
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell, i, all) => !(cell === '' && (i === 0 || i === all.length - 1)));
      blocks.push({ kind: 'contact', name, role, phone });
      continue;
    }
    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (paragraph.length) {
        blocks.push({ kind: 'p', text: paragraph.join(' ') });
        paragraph = [];
      }
      list.push(bullet[1] ?? '');
      continue;
    }
    if (list.length) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
};
