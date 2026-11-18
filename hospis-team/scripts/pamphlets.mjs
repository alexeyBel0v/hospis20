/**
 * Памятки для родственников → PDF в public/pamyatki/.
 * Запуск: node scripts/pamphlets.mjs (нужен playwright и шрифт Onest из @fontsource/onest).
 * Текст правится здесь, потом скрипт запускается заново.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright');
const FONTS = process.env.FONTS; // папка node_modules/@fontsource/onest/files

const font = (w) => `data:font/woff2;base64,${readFileSync(`${FONTS}/onest-cyrillic-${w}-normal.woff2`).toString('base64')}`;
const fontLatin = (w) => `data:font/woff2;base64,${readFileSync(`${FONTS}/onest-latin-${w}-normal.woff2`).toString('base64')}`;

export const PAMPHLETS = [
  {
    id: 'prolezhni',
    title: 'Как ухаживать за лежачим и не допустить пролежней',
    lead: 'Пролежень появляется, когда кожа долго прижата к кровати. Его легче не допустить, чем вылечить.',
    sections: [
      ['Положение в постели: менять каждые 2 часа', [
        'Переворачивайте близкого не реже чем раз в 2 часа, и ночью тоже.',
        'На бок — не прямо, а немного наклонно, подложив подушку под спину.',
        'Подушку под голени — пятки должны «висеть» и не касаться кровати.',
        'Подушку между коленями и между лодыжками.',
        'Если сидит в кресле — меняйте положение каждый час.',
        'Не тяните по простыне: приподнимайте вдвоём или на подкладной простыне — трение повреждает кожу.',
        'Изголовье поднимайте как можно меньше, если врач не сказал иначе.',
      ]],
      ['Кожа — сухая и чистая', [
        'Каждый день осматривайте: крестец, пятки, бёдра, лопатки, затылок, локти.',
        'Мойте мягко и промакивайте полотенцем, не трите.',
        'При недержании меняйте подгузник и бельё сразу, кожу защищайте кремом, который посоветует медсестра.',
        'Следите, чтобы на простыне не было складок и крошек.',
      ]],
      ['Еда и питьё', [
        'Нужен белок: творог, яйца, мясо, рыба, кисломолочное — если врач не ограничил.',
        'Предлагайте пить понемногу в течение дня.',
      ]],
      ['Сразу сообщите медсестре, если', [
        'покраснение не бледнеет, когда на него нажимаешь пальцем;',
        'появился пузырь, ранка или тёмное пятно;',
        'у раны неприятный запах, гной, повысилась температура.',
      ]],
    ],
    note: 'Противопролежневый матрас и функциональную кровать можно получить бесплатно по программе реабилитации (ИПРА). Спросите у врача.',
  },
  {
    id: 'kateter',
    title: 'Уход за мочевым катетером дома',
    lead: 'Катетер выводит мочу из мочевого пузыря в мешок. Простые правила помогают избежать воспаления.',
    sections: [
      ['Каждый день', [
        'Мойте руки до и после любого ухода за катетером.',
        'Подмывайте половые органы мягким мылом, затем трубку — от тела вниз, не натягивая её.',
        'Не принимайте ванну, пока стоит катетер. Душ — можно.',
      ]],
      ['Мешок для мочи', [
        'Мешок всегда ниже уровня живота и не лежит на полу.',
        'Трубка без перегибов, на ней нельзя лежать.',
        'Ножной мешок опорожняйте каждые 2–4 часа, не давайте ему переполниться.',
        'На ночь подключайте большой мешок.',
        'Меняйте мешки так, как сказала медсестра, и сразу — если мешок порвался или засорился.',
      ]],
      ['Питьё', [
        'Если врач не ограничил жидкость, предлагайте пить в течение дня.',
      ]],
      ['Срочно звоните, если', [
        'катетер выпал — не вставляйте его сами;',
        'моча перестала поступать в мешок или её стало намного меньше, болит низ живота;',
        'температура 38 °C и выше, озноб;',
        'в моче ярко-красная кровь или сгустки;',
        'моча мутная, с хлопьями или неприятным запахом.',
      ]],
    ],
    note: 'Когда менять катетер, решает врач. Отметьте здесь дату постановки, чтобы не забыть: ______________',
  },
  {
    id: 'bol',
    title: 'Боль: как понять, насколько сильно болит',
    lead: 'Боль можно и нужно уменьшать. Чтобы врач подобрал лечение, ему важно знать, насколько сильно болит и когда.',
    scale: true,
    sections: [
      ['Спрашивайте каждый день', [
        '«Оцени боль от 0 до 10, где 0 — не болит совсем, а 10 — сильнее не бывает».',
        'Спрашивайте и в покое, и когда человек двигается или его переворачивают.',
        'Записывайте ответ, время и что помогло — покажете врачу или медсестре.',
      ]],
      ['Если человек не может сказать', [
        'Обратите внимание на стоны, гримасу, сжатые кулаки, напряжённое тело, частое дыхание.',
        'Беспокойство и спутанность тоже могут быть признаком боли.',
      ]],
      ['Обезболивающие', [
        'Давайте лекарства по часам, как назначил врач, а не только «когда заболит».',
        'Не меняйте дозу и не отменяйте лекарство сами.',
        'Запоры, тошнота, сонливость — расскажите врачу, это можно облегчить.',
      ]],
      ['Звоните, если', [
        'боль 7 и больше или усилилась, а лекарство не помогает;',
        'появилась новая сильная боль;',
        'человек стал очень сонливым или дышит редко.',
      ]],
    ],
    note: 'Дневник: дата и время — боль от 0 до 10 — что дали — стало ли легче.',
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const scaleSvg = () => {
  const cells = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const r = Math.round(220 + 30 * t), g = Math.round(236 - 150 * t), b = Math.round(222 - 160 * t);
    return `<div class="sc"><div class="sc__box" style="background:rgb(${r},${g},${b})">${i}</div></div>`;
  }).join('');
  return `<div class="scale">${cells}</div><div class="scale__labels"><span>не болит</span><span>слабая</span><span>умеренная</span><span>сильная</span></div>`;
};

const page = (p) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@font-face{font-family:Onest;font-weight:400;src:url(${font(400)})}
@font-face{font-family:Onest;font-weight:600;src:url(${font(600)})}
@font-face{font-family:Onest;font-weight:700;src:url(${font(700)})}
@font-face{font-family:Onest;font-weight:400;src:url(${fontLatin(400)});unicode-range:U+0000-00FF}
@font-face{font-family:Onest;font-weight:700;src:url(${fontLatin(700)});unicode-range:U+0000-00FF}
@page{size:A4;margin:12mm 14mm 10mm}
*{box-sizing:border-box}
body{margin:0;font-family:Onest,sans-serif;color:#26302b;font-size:10.5pt;line-height:1.4}
.top{display:flex;align-items:center;gap:10px;color:#2e7a68;font-weight:700;font-size:10pt;margin-bottom:6mm}
.logo{width:26px;height:26px}
h1{font-size:20pt;line-height:1.15;margin:0 0 3mm;letter-spacing:-.01em}
.lead{font-size:11.5pt;color:#414b45;margin:0 0 5mm;max-width:160mm}
h2{font-size:13pt;margin:0 0 2mm;color:#236151}
section{break-inside:avoid;margin-bottom:3mm;padding:3mm 5mm;border-radius:4mm;background:#f3f5ef}
ul{margin:0;padding-left:5mm}
li{margin:.6mm 0}
.note{margin-top:4mm;padding:4mm 5mm;border-radius:4mm;background:#f6ead0;color:#5c3d06;font-weight:600}
.scale{display:flex;gap:2mm;margin:0 0 1.5mm}
.sc{flex:1}
.sc__box{height:12mm;border-radius:2.5mm;display:grid;place-items:center;font-weight:700;font-size:13pt}
.scale__labels{display:grid;grid-template-columns:1fr 3fr 3fr 4fr;gap:2mm;font-size:9.5pt;color:#6e766f;margin-bottom:5mm;text-align:center}
.phones{margin-top:5mm;border-top:1px solid #dfe3da;padding-top:4mm;font-size:10.5pt;display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm}
.phones b{display:block;font-size:12pt}
.blank{border-bottom:1px solid #9aa39b;height:6mm}
.foot{margin-top:4mm;font-size:8.5pt;color:#8a918b}
</style></head><body>
<div class="top"><svg class="logo" viewBox="0 0 64 64"><rect width="64" height="64" rx="20" fill="#2e7a68"/><path d="M9 33h11l5-11 7 20 5-13h18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>Памятка для родных</div>
<h1>${esc(p.title)}</h1>
<p class="lead">${esc(p.lead)}</p>
${p.scale ? scaleSvg() : ''}
${p.sections.map(([h, items]) => `<section><h2>${esc(h)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('')}
<div class="note">${esc(p.note)}</div>
<div class="phones">
<div>Выездная служба<div class="blank"></div></div>
<div>Медсестра<div class="blank"></div></div>
<div>Координационный центр паллиативной помощи, круглосуточно<b>+7 499 444-04-57</b></div>
<div>Скорая помощь<b>103</b></div>
</div>
<p class="foot">Памятка не заменяет советов вашего врача и медсестры.</p>
</body></html>`;

const out = process.argv[2] ?? 'public/pamyatki';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage();
for (const p of PAMPHLETS) {
  await tab.setContent(page(p));
  await tab.evaluate(() => document.fonts.ready);
  await tab.pdf({ path: `${out}/${p.id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true, scale: 0.92 });
}
writeFileSync(`${out}/list.json`, JSON.stringify(PAMPHLETS.map(({ id, title }) => ({ id, title }))));
await browser.close();
console.log('ok', PAMPHLETS.length);
