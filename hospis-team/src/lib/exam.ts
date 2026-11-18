import type { Patient } from '../types.ts';
import { formatDots, isIsoDate } from './dates.ts';

/**
 * Осмотр медсестры: выбор из вариантов → текст по шаблону отделения.
 * Не заполнено — [указать …]. Медицинских выводов приложение не делает, только собирает выбранное.
 */

export type Exam = {
  presence: string;
  carer: string;
  activity: string;
  bed: string;
  care: string;
  help: string;
  allergy: string;
  hr: string;
  bp: string;
  rr: string;
  spo2: string;
  temp: string;
  dyspnea: string;
  cough: string;
  appetite: string;
  mucosa: string;
  musculo: string;
  skin: string;
  edema: string;
  edemaWhere: string;
  turgor: string;
  ulcers: boolean;
  urination: string;
  urineColor: string;
  abdomen: string;
  stool: string;
  lastStool: string;
  contact: string;
  consciousness: string;
  localis: string;
  refusedDressing: boolean;
  wantsHospice: boolean;
  badHygiene: boolean;
  pps: string;
  norton: number[];
  morse: number[];
  extra: string;
};

export const OPTIONS = {
  presence: ['пациента', 'дочери', 'сына', 'супруга', 'супруги', 'сиделки', 'родственников', 'соцработника'],
  carer: ['дочь', 'сын', 'супруг', 'супруга', 'сиделка', 'родственники', 'соцработник', 'пациент самостоятельно'],
  activity: ['активен', 'активен в пределах квартиры', 'активен в пределах кровати самостоятельно', 'активен в пределах кровати с помощью', 'неактивен'],
  bed: ['обычной кровати', 'функциональной кровати', 'функциональной кровати с противопролежневым матрасом', 'обычной кровати с противопролежневым матрасом'],
  care: ['тотальный уход', 'частичный уход', 'уход не требуется'],
  help: ['полностью нуждается в посторонней помощи', 'частично нуждается в посторонней помощи', 'в посторонней помощи не нуждается'],
  allergy: ['не отягощён'],
  yesNo: ['нет', 'есть'],
  appetite: ['норма', 'снижен', 'отсутствует'],
  mucosa: ['без особенностей', 'бледные', 'сухие', 'цианотичные'],
  musculo: ['без патологии', 'контрактуры', 'атрофия мышц', 'деформации суставов'],
  skin: ['сухие', 'нормальной влажности', 'влажные', 'бледные', 'желтушные'],
  turgor: ['сохранён', 'снижен'],
  urination: ['контролируемое, самостоятельное', 'неконтролируемое, самостоятельное', 'по уретральному катетеру', 'по цистостоме', 'в подгузник'],
  urineColor: ['норма', 'концентрированная', 'мутная', 'с примесью крови'],
  abdomen: ['мягкий, безболезненный', 'мягкий, болезненный', 'вздут', 'напряжён'],
  stool: ['регулярный, оформленный', 'запор', 'жидкий', 'через стому'],
  contact: ['продуктивный', 'частично продуктивный', 'непродуктивный', 'недоступен'],
  consciousness: ['ясное', 'спутанное', 'оглушение', 'сопор', 'кома'],
  pps: ['100', '90', '80', '70', '60', '50', '40', '30', '20', '10'],
} as const;

/** Шкала Нортон: 5 пунктов по 1–4 балла, меньше — хуже. */
export const NORTON = [
  { name: 'Физическое состояние', options: ['хорошее', 'удовлетворительное', 'плохое', 'очень плохое'] },
  { name: 'Психическое состояние', options: ['ясное', 'апатия', 'спутанность', 'ступор'] },
  { name: 'Активность', options: ['ходит сам', 'ходит с помощью', 'сидит в кресле', 'лежачий'] },
  { name: 'Подвижность', options: ['полная', 'немного ограничена', 'сильно ограничена', 'обездвижен'] },
  { name: 'Недержание', options: ['нет', 'иногда', 'обычно мочи', 'мочи и кала'] },
];
/** Индекс варианта 0..3 → балл 4..1 */
export const nortonScore = (picked: number[]) => (picked.length === 5 && picked.every((i) => i >= 0) ? picked.reduce((s, i) => s + (4 - i), 0) : null);
export const nortonRisk = (score: number) => (score <= 12 ? 'высокий риск пролежней' : score <= 14 ? 'есть риск пролежней' : 'риск пролежней низкий');

/** Шкала Морсе: баллы за каждый вариант. */
export const MORSE = [
  { name: 'Падения за последние 3 месяца', options: [['нет', 0], ['да', 25]] },
  { name: 'Сопутствующее заболевание', options: [['нет', 0], ['да', 15]] },
  { name: 'Вспомогательные средства', options: [['нет / постельный режим / помогает медсестра', 0], ['костыли, трость, ходунки', 15], ['опирается на мебель', 30]] },
  { name: 'Внутривенная инфузия, катетер', options: [['нет', 0], ['да', 20]] },
  { name: 'Походка', options: [['нормальная / постельный режим / кресло', 0], ['слабая', 10], ['нарушенная', 20]] },
  { name: 'Психический статус', options: [['адекватно оценивает свои возможности', 0], ['забывает о своих ограничениях', 15]] },
] as const;
export const morseScore = (picked: number[]) =>
  picked.length === 6 && picked.every((i) => i >= 0) ? picked.reduce((s, i, k) => s + (MORSE[k]?.options[i]?.[1] ?? 0), 0) : null;
export const morseRisk = (score: number) => (score >= 45 ? 'высокий риск падения' : score >= 25 ? 'умеренный риск падения' : 'низкий риск падения');

export const emptyExam = (): Exam => ({
  presence: '',
  carer: '',
  activity: '',
  bed: '',
  care: '',
  help: '',
  allergy: 'не отягощён',
  hr: '',
  bp: '',
  rr: '',
  spo2: '',
  temp: '',
  dyspnea: 'нет',
  cough: 'нет',
  appetite: 'норма',
  mucosa: 'без особенностей',
  musculo: 'без патологии',
  skin: '',
  edema: 'нет',
  edemaWhere: '',
  turgor: '',
  ulcers: false,
  urination: '',
  urineColor: 'норма',
  abdomen: 'мягкий, безболезненный',
  stool: 'регулярный, оформленный',
  lastStool: '',
  contact: '',
  consciousness: 'ясное',
  localis: '',
  refusedDressing: false,
  wantsHospice: false,
  badHygiene: false,
  pps: '',
  norton: [-1, -1, -1, -1, -1],
  morse: [-1, -1, -1, -1, -1, -1],
  extra: '',
});

/** Черновик под пациента: что уже известно из карточки. Показатели (пульс, давление) каждый раз заново. */
export const examFor = (patient: Patient, last: Partial<Exam> | null): Exam => {
  const base = { ...emptyExam(), ...(last ?? {}) };
  const fresh = { hr: '', bp: '', rr: '', spo2: '', temp: '', lastStool: '', refusedDressing: false, extra: '' };
  return {
    ...base,
    ...fresh,
    ulcers: base.ulcers || Boolean(patient.wounds),
    urination: base.urination || (patient.catheter.type === 'urinary' ? 'по уретральному катетеру' : patient.catheter.type === 'cysto' ? 'по цистостоме' : ''),
    allergy: patient.allergy ? `отягощён: ${patient.allergy}` : base.allergy,
    localis: patient.wounds ? patient.wounds.replace(/^\d{2}\.\d{2}\.\d{4}:\s*/, '').replace(/^Status localis:\s*/i, '') : base.localis,
  };
};

const v = (value: string, what: string) => (value.trim() ? value.trim() : `[указать ${what}]`);

export const examText = (e: Exam, contacts: string): string => {
  const p: string[] = [];
  p.push(`Визит в присутствии ${v(e.presence, 'кого')}. Уход осуществляет ${v(e.carer, 'кто')}.`);
  p.push(`Активность пациента — ${v(e.activity, 'активность')}. Лежит на ${v(e.bed, 'какой кровати')}. Требуется ${v(e.care, 'объём ухода')}. ${capital(v(e.help, 'нужна ли помощь'))}.`);
  p.push(`Аллергоанамнез — ${v(e.allergy, 'аллергоанамнез')}.`);
  p.push('Данные состояния пациента на осмотре:');
  p.push(`Система кровообращения: ЧСС — ${v(e.hr, 'ЧСС')} уд/мин${e.bp.trim() ? `, АД — ${e.bp.trim()} мм рт. ст.` : ''}.${e.temp.trim() ? ` Температура тела — ${e.temp.trim()} °C.` : ''}`);
  p.push(`Система органов дыхания: ЧДД — ${v(e.rr, 'ЧДД')} в мин, SpO₂ — ${v(e.spo2, 'SpO₂')}%, одышка — ${e.dyspnea}, кашель — ${e.cough}.`);
  p.push(`Аппетит — ${e.appetite}. Видимые слизистые — ${e.mucosa}. Костно-мышечная система — ${e.musculo}.`);
  p.push(
    `Кожные покровы — ${v(e.skin, 'кожу')}, отёки — ${e.edema}${e.edema === 'есть' ? ` (${v(e.edemaWhere, 'где')})` : ''}, тургор — ${v(e.turgor, 'тургор')}.${
      e.ulcers ? ' Кожные покровы пациента имеют признаки декубитальных изменений (пролежней) и трофических нарушений.' : ''
    }`,
  );
  p.push(`Система органов мочевыделения: мочеиспускание — ${v(e.urination, 'мочеиспускание')}, цвет мочи — ${e.urineColor}.`);
  p.push(
    `Система органов пищеварения: живот — ${e.abdomen}. Стул — ${e.stool}.${e.lastStool && isIsoDate(e.lastStool) ? ` Дата последней дефекации — ${formatDots(e.lastStool)}.` : ` Дата последней дефекации — [указать].`}`,
  );
  p.push(`Состояние нервно-психической системы: контакт — ${v(e.contact, 'контакт')}, сознание — ${e.consciousness}.`);
  if (e.refusedDressing) {
    p.push(
      'Status localis: нет возможности оценить состояние кожных покровов под повязкой, так как от предложенной перевязки пациент отказался. Проведена беседа о необходимости регулярной обработки ран и возможных рисках при отказе от лечения. Пациент предупреждён о возможных осложнениях, однако от перевязки отказывается.',
    );
  } else if (e.localis.trim()) {
    p.push(`Status localis: ${e.localis.trim().replace(/[.\s]*$/, '.')}`);
  }
  if (e.wantsHospice) p.push('Просит госпитализацию в хоспис. Информация передана заведующей ВПС. Пациент поставлен в план на госпитализацию.');
  if (e.badHygiene) {
    p.push(
      'Санитарно-гигиенические условия неудовлетворительные: в помещении отмечается стойкий неприятный запах, постельное бельё и нательная одежда пациента загрязнены. Уход за пациентом осуществляется нерегулярно, личная гигиена не соблюдается. Проведена разъяснительная беседа о необходимости соблюдения гигиены и регулярного ухода.',
    );
  }
  if (e.extra.trim()) p.push(e.extra.trim());
  p.push(contacts);
  const n = nortonScore(e.norton);
  const m = morseScore(e.morse);
  p.push(
    `PPS: ${e.pps ? `${e.pps}%` : '[указать]'}. По шкале Морсе: ${m === null ? '[указать]' : `${m} баллов — ${morseRisk(m)}`}. По шкале Нортон: ${n === null ? '[указать]' : `${n} баллов — ${nortonRisk(n)}`}.`,
  );
  return p.join('\n');
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
