import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const appVersion = (): string => {
  const config = readFileSync(new URL('./src/config.ts', import.meta.url), 'utf8');
  return /APP_VERSION = '([^']+)'/.exec(config)?.[1] ?? '0.0.0';
};

type Manifest = { version: string; entry: string; css: string[] };

/**
 * Защита от кэша Telegram.
 *
 * Telegram держит index.html в кэше и показывает старую версию. Поэтому index.html делаем
 * «загрузчиком», который сам почти никогда не меняется: при каждом открытии он скачивает
 * свежий version.json (в обход кэша) и подключает тот код, который там указан.
 * Код лежит в файлах с уникальными именами (assets/index-abc123.js), их кэш не мешает.
 */
const freshLoader = (): Plugin => ({
  name: 'hospis-fresh-loader',
  apply: 'build',
  writeBundle(options, bundle) {
    const outDir = options.dir ?? 'dist';
    const entry = Object.values(bundle).find((item) => item.type === 'chunk' && item.isEntry);
    if (!entry || entry.type !== 'chunk') throw new Error('Не найден основной файл сборки');
    const css = [...(entry.viteMetadata?.importedCss ?? [])];
    const manifest: Manifest = { version: appVersion(), entry: entry.fileName, css };
    writeFileSync(join(outDir, 'version.json'), JSON.stringify(manifest));

    const htmlPath = join(outDir, 'index.html');
    const html = readFileSync(htmlPath, 'utf8')
      .replace(/\s*<script type="module" crossorigin src="[^"]+"><\/script>/g, '')
      .replace(/\s*<link rel="stylesheet" crossorigin href="[^"]+">/g, '');
    const loader = `<script>
(function () {
  var fallback = ${JSON.stringify(manifest)};
  var started = false;
  function start(m) {
    if (started) return;
    started = true;
    window.__HOSPIS_BUILD__ = m.version;
    m.css.forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
    var script = document.createElement('script');
    script.type = 'module';
    script.src = m.entry;
    script.onerror = function () {
      if (m.entry !== fallback.entry) { started = false; start(fallback); }
    };
    document.body.appendChild(script);
  }
  var timer = setTimeout(function () { start(fallback); }, 3500);
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) { clearTimeout(timer); start(m && m.entry ? m : fallback); })
    .catch(function () { clearTimeout(timer); start(fallback); });
})();
</script>`;
    writeFileSync(htmlPath, html.replace('</body>', `${loader}\n</body>`));
  },
});

// base: './' — сайт работает из подпапки (username.github.io/hospis-os/)
export default defineConfig({
  base: './',
  plugins: [react(), freshLoader()],
});
