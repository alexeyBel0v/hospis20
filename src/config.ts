export const APP_NAME = 'Hospis OS';

/** Меняйте при каждом обновлении — по ней приложение понимает, что вышла новая версия. */
export const APP_VERSION = '1.0.3';

/**
 * Отпечаток пароля входа (SHA-256 от «hospis-os:» + пароль). Сам пароль в коде не хранится.
 * Сменить: npm run password -- новыйпароль
 */
export const PASSWORD_HASH = 'cdbfe2380e9eb1c379306c5866edb5b6fb82d31732e156cd91561b25ab78515e';
