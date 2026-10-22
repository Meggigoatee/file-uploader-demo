// Development tool smoke checks. This does not exercise application features.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cloudflare } from '@cloudflare/vite-plugin';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { chromium } from '@playwright/test';

const evidenceDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(evidenceDirectory, '../..');
const reportFile = process.argv[2]
  ? resolve(root, process.argv[2])
  : join(evidenceDirectory, `ENV-${new Date().toISOString().replace(/[:.]/g, '-')}-smoke.json`);
const relativeReport = relative(evidenceDirectory, reportFile);
assert.ok(!relativeReport.startsWith('..') && !isAbsolute(relativeReport), 'report must stay inside .docs/verification');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const modules = JSON.parse(readFileSync(join(root, 'node_modules/.modules.yaml'), 'utf8'));
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  packageManager: manifest.packageManager,
  storeDir: modules.storeDir,
  packages: {},
  checks: {},
};

try {
  for (const [name, expected] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    const installed = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
    assert.equal(installed.version, expected, `${name} version`);
    report.packages[name] = installed.version;
  }
  assert.equal(typeof cloudflare, 'function');
  assert.equal(typeof cloudflareTest, 'function');
  report.checks.packageVersionsAndPluginImports = 'passed';

  const virtualEntry = join(root, '__environment_smoke__.ts');
  const virtualComponent = join(root, '__environment_smoke__.vue');
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'environment-smoke-source',
        resolveId(id) {
          if (id === virtualEntry) return virtualEntry;
          if (id === 'environment-smoke-component') return virtualComponent;
        },
        load(id) {
          if (id === virtualEntry) {
            return "export { default } from 'environment-smoke-component';";
          }
          if (id === virtualComponent) {
            return '<script setup lang="ts">const message: string = "environment ready";</script><template><p>{{ message }}</p></template>';
          }
        },
      },
      vue(),
    ],
    build: {
      write: false,
      lib: { entry: virtualEntry, formats: ['es'] },
      rollupOptions: { external: ['vue'] },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  assert.ok(outputs.flatMap((output) => output.output).some((item) => item.type === 'chunk' && item.code.includes('environment ready')));
  report.checks.vueTypeScriptViteInMemoryBuild = 'passed';

  const workerRequire = createRequire(realpathSync(join(root, 'node_modules/wrangler/package.json')));
  const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = await import(pathToFileURL(workerRequire.resolve('miniflare')).href);
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    compatibilityDate: '2026-08-28',
    script: 'export default { fetch() { return new Response("runtime ready"); } };',
    d1Databases: { DB: 'environment-smoke-db' },
    r2Buckets: { UPLOADS: 'environment-smoke-bucket' },
    log: new Log(LogLevel.ERROR),
  }));
  try {
    const response = await runtime.dispatchFetch('http://localhost/');
    assert.equal(await response.text(), 'runtime ready');
    const database = await runtime.getD1Database('DB');
    assert.equal((await database.prepare('SELECT 1 AS ready').first()).ready, 1);
    const bucket = await runtime.getR2Bucket('UPLOADS');
    await bucket.put('environment-smoke', 'environment ready');
    assert.equal(await (await bucket.get('environment-smoke')).text(), 'environment ready');
    await bucket.delete('environment-smoke');
    assert.equal(await bucket.get('environment-smoke'), null);
    report.checks.localWorkerD1R2 = 'passed';
  } finally {
    await runtime.dispose();
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<title>Environment ready</title><p>Environment ready</p>');
    assert.equal(await page.title(), 'Environment ready');
    report.checks.chromiumLaunch = 'passed';
    report.chromium = { version: browser.version(), executablePath: chromium.executablePath() };
  } finally {
    await browser.close();
  }
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  const output = JSON.stringify(report, null, 2) + '\n';
  mkdirSync(dirname(reportFile), { recursive: true });
  writeFileSync(reportFile, output);
  console.log(output);
}
