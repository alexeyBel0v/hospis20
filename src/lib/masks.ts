const digits = (value: string) => value.replace(/\D/g, '');

/** «7700123456780001» → «7700 1234 5678 0001» */
export const formatPolicy = (value: string): string =>
  digits(value)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

export const isPolicyComplete = (value: string) => digits(value).length === 16;

/** «89099099797» → «+7 909 909-97-97» (пока вводят — частично). */
export const formatPhone = (value: string): string => {
  let d = digits(value);
  if (!d) return '';
  if (d[0] === '8') d = `7${d.slice(1)}`;
  if (d[0] !== '7') d = `7${d}`;
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = '+7';
  if (p[0]) out += ` ${p[0]}`;
  if (p[1]) out += ` ${p[1]}`;
  if (p[2]) out += `-${p[2]}`;
  if (p[3]) out += `-${p[3]}`;
  return out;
};

export const isPhoneComplete = (value: string) => digits(value).length === 11;

/** Для ссылки tel: */
export const phoneHref = (value: string) => `tel:+${digits(formatPhone(value))}`;
