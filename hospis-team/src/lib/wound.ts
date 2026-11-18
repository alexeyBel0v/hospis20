import { pluralRu } from './dates.ts';

/**
 * Status localis раны по шаблону. Текст собирает приложение, а не ИИ:
 * что не указано — остаётся пометкой [указать …], ничего не придумывается.
 */

export type Wound = {
  kind: string;
  stage: string | null;
  location: string;
  length: number | null;
  width: number | null;
  depth: number | null;
  granulation: number | null;
  fibrin: number | null;
  necrosis: number | null;
  necrosisType: string | null;
  exudateAmount: string | null;
  exudateType: string | null;
  odor: boolean | null;
  edges: string[];
  skin: string[];
  hyperemiaCm: number | null;
  tunneling: string | null;
  pain: number | null;
  dressing: string | null;
};

export const STAGES = ['1', '2', '3', '4', 'неклассифицируемая', 'глубокое повреждение тканей'];
export const EXUDATE_AMOUNTS = ['нет', 'скудное', 'умеренное', 'обильное'];
export const EXUDATE_TYPES = ['серозное', 'серозно-геморрагическое', 'геморрагическое', 'гнойное'];
export const EDGES = ['ровные', 'неровные', 'подрытые', 'мацерированные', 'с краевой эпителизацией', 'гиперкератоз'];
export const SKIN = ['без изменений', 'гиперемия', 'отёк', 'мацерация', 'уплотнение', 'повышение местной температуры'];

export const emptyWound = (): Wound => ({
  kind: 'пролежень',
  stage: null,
  location: '',
  length: null,
  width: null,
  depth: null,
  granulation: null,
  fibrin: null,
  necrosis: null,
  necrosisType: null,
  exudateAmount: null,
  exudateType: null,
  odor: null,
  edges: [],
  skin: [],
  hyperemiaCm: null,
  tunneling: null,
  pain: null,
  dressing: null,
});

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() && v.trim() !== 'null' ? v.trim() : null);
const list = (v: unknown, allowed: string[]): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)) : []);

/** Ответ ИИ → параметры раны. Значения вне списков отбрасываются. */
export const woundFromAi = (raw: Record<string, unknown>): Wound => {
  const stage = str(raw.stage);
  return {
    kind: str(raw.kind) ?? 'пролежень',
    stage: stage && STAGES.includes(stage) ? stage : null,
    location: str(raw.location) ?? '',
    length: num(raw.length),
    width: num(raw.width),
    depth: num(raw.depth),
    granulation: num(raw.granulation),
    fibrin: num(raw.fibrin),
    necrosis: num(raw.necrosis),
    necrosisType: str(raw.necrosisType),
    exudateAmount: EXUDATE_AMOUNTS.find((x) => x === raw.exudateAmount) ?? null,
    exudateType: EXUDATE_TYPES.find((x) => x === raw.exudateType) ?? null,
    odor: typeof raw.odor === 'boolean' ? raw.odor : null,
    edges: list(raw.edges, EDGES),
    skin: list(raw.skin, SKIN),
    hyperemiaCm: num(raw.hyperemiaCm),
    tunneling: str(raw.tunneling),
    pain: num(raw.pain),
    dressing: str(raw.dressing),
  };
};

const cm = (n: number) => n.toFixed(1).replace('.', ',');
const ask = (what: string) => `[указать ${what}]`;

/** Подсказки по классификации — не исправляют сами, только предупреждают. */
export const woundWarnings = (w: Wound): string[] => {
  const out: string[] = [];
  if (w.kind === 'пролежень' && w.necrosis !== null && w.necrosis >= 100 && w.stage !== 'неклассифицируемая') {
    out.push('Дно полностью закрыто некрозом или струпом — по классификации NPIAP это неклассифицируемая стадия: глубину оценить нельзя.');
  }
  if (w.stage === '1' && (w.length !== null || w.granulation !== null || w.exudateAmount)) {
    out.push('1 стадия — кожа цела, раны нет. Если есть дефект кожи — это уже 2 стадия и выше.');
  }
  if (w.stage === '2' && (w.granulation || w.necrosis || w.depth)) {
    out.push('2 стадия — поверхностная рана без грануляций, некроза и видимой клетчатки. Проверьте стадию.');
  }
  const sum = (w.granulation ?? 0) + (w.fibrin ?? 0) + (w.necrosis ?? 0);
  if (sum > 0 && sum !== 100) out.push(`Ткани дна в сумме ${sum}%, а должно быть 100%.`);
  return out;
};

export const woundText = (w: Wound): string => {
  const stage =
    w.kind !== 'пролежень'
      ? ''
      : w.stage === null
        ? ` ${ask('стадию')}`
        : /^\d$/.test(w.stage)
          ? ` ${w.stage} стадии (NPIAP)`
          : w.stage === 'неклассифицируемая'
            ? ' неклассифицируемой стадии (NPIAP)'
            : ' — глубокое повреждение тканей (NPIAP)';
  const where = w.location ? `в области ${w.location}` : ask('локализацию');
  const size =
    w.length !== null && w.width !== null
      ? `размерами ${cm(w.length)}×${cm(w.width)} см${w.depth !== null ? `, глубиной ${cm(w.depth)} см` : ''}`
      : `размерами ${ask('длину×ширину в см')}`;

  const parts: string[] = [];
  parts.push(`Status localis: ${where} ${w.kind}${stage} ${size}.`);

  if (w.stage === '1') {
    parts.push('Кожа цела, гиперемия не бледнеет при надавливании.');
  } else {
    const bed = [
      w.granulation !== null && `грануляции ${w.granulation}%`,
      w.fibrin !== null && `фибрин ${w.fibrin}%`,
      w.necrosis !== null && `некроз${w.necrosisType ? ` (${w.necrosisType})` : ''} ${w.necrosis}%`,
    ].filter(Boolean);
    parts.push(`Дно раны: ${bed.length ? bed.join(', ') : ask('ткани дна в %')}.`);
    if (w.tunneling) parts.push(`Карманы, ходы: ${w.tunneling}.`);
    const exudate =
      w.exudateAmount === 'нет'
        ? 'Отделяемого нет'
        : `Отделяемое ${w.exudateAmount ?? ask('количество')}, ${w.exudateType ?? ask('характер')}`;
    const odor = w.odor === null ? `, запах ${ask('есть/нет')}` : w.odor ? ', с неприятным запахом' : ', без запаха';
    parts.push(`${exudate}${odor}.`);
    parts.push(`Края раны: ${w.edges.length ? w.edges.join(', ') : ask('края')}.`);
  }

  const skin = w.skin.filter((s) => s !== 'без изменений');
  parts.push(
    `Кожа вокруг: ${
      w.skin.includes('без изменений') && !skin.length
        ? 'без изменений'
        : skin.length
          ? skin.map((s) => (s === 'гиперемия' && w.hyperemiaCm !== null ? `гиперемия до ${cm(w.hyperemiaCm)} см` : s)).join(', ')
          : ask('состояние кожи')
    }.`,
  );
  parts.push(`Болезненность при перевязке: ${w.pain !== null ? `${w.pain} ${pluralRu(w.pain, 'балл', 'балла', 'баллов')} по НОШ` : ask('баллы 0–10')}.`);
  if (w.dressing) parts.push(`Выполнено: ${w.dressing}.`);
  return parts.join(' ');
};
