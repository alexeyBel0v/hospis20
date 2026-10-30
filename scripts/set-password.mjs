// Сменить пароль входа: npm run password -- новыйпароль
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const password = process.argv[2];
if (!password) {
  console.error('Укажите пароль: npm run password -- новыйпароль');
  process.exit(1);
}
const hash = createHash('sha256').update(`hospis-os:${password.trim().toLowerCase()}`).digest('hex');
const file = new URL('../src/config.ts', import.meta.url);
const source = readFileSync(file, 'utf8');
writeFileSync(file, source.replace(/PASSWORD_HASH = '[0-9a-f]*'/, `PASSWORD_HASH = '${hash}'`));
console.log('Готово. Пароль изменён — опубликуйте обновление (git push / загрузка на GitHub).');
