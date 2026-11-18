/** Скачать файл. Внутри Telegram на телефоне — откроется окно «Поделиться/Сохранить». */
export const downloadFile = (name: string, content: string, type = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Таблица для Excel: «;» и BOM, чтобы кириллица открылась без настроек. */
export const toCsv = (rows: Array<Array<string | number>>): string =>
  `﻿${rows.map((row) => row.map((cell) => {
    const text = String(cell);
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(';')).join('\r\n')}\r\n`;
