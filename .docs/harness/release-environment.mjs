import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [versionId, sourceCommit] = process.argv.slice(2);
const baseURL = 'https://file-uploader-demo.meggigoatee.workers.dev';
const prefix = '.docs/verification/RELEASE-20261023';
const output = prefix + '-environment.json';
const report = { checkedAt: new Date().toISOString(), baseURL, stage: 'post-deploy', deploymentVersionId: versionId, sourceCommit, result: 'failed', checks: {} };
const redact = value => JSON.parse(JSON.stringify(value, (key, item) => /email|author_id/i.test(key) ? '[REDACTED]' : item));
function cli(name, args, json = false) {
  const raw = execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  const result = json ? redact(JSON.parse(raw)) : raw;
  writeFileSync(prefix + '-' + name + (json ? '.json' : '.log'), json ? JSON.stringify(result, null, 2) + '\n' : raw);
  return result;
}
try {
  assert.match(versionId ?? '', /^[0-9a-f-]{36}$/); assert.match(sourceCommit ?? '', /^[0-9a-f]{40}$/);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceCommit);
  const baseline = JSON.parse(readFileSync('.docs/verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/report.json', 'utf8'));
  assert.equal(baseline.result, 'passed'); report.checks.localBaseline151 = true;
  const deployments = cli('deployments-after', ['deployments', 'list', '--json'], true);
  const active = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  assert.deepEqual(active.versions.map(v => ({ id: v.version_id, percentage: v.percentage })), [{ id: versionId, percentage: 100 }]);
  report.checks.activeVersion100Percent = true;
  const version = cli('version-after', ['versions', 'view', versionId, '--json'], true);
  assert.equal(version.id, versionId);
  const bindings = version.resources.bindings;
  assert(bindings.some(b => b.name === 'DB' && b.type === 'd1' && b.id === 'a5987b22-0ad5-4813-9b4c-55132f580912'));
  assert(bindings.some(b => b.name === 'UPLOADS' && b.type === 'r2_bucket' && b.bucket_name === 'file-uploader-demo'));
  assert(bindings.some(b => b.name === 'ASSETS' && b.type === 'assets'));
  assert.equal(version.resources.script_runtime.compatibility_date, '2026-08-28'); report.checks.bindingsAndRuntime = true;

  const sql = "SELECT name FROM d1_migrations ORDER BY id; SELECT name FROM sqlite_master WHERE type='table' ORDER BY name; PRAGMA foreign_key_check; SELECT id,reserved_bytes,reserved_puts FROM upload_budget; SELECT s.id FROM anonymous_sessions s LEFT JOIN session_extension_policies p ON p.session_id=s.id GROUP BY s.id HAVING SUM(CASE WHEN p.kind='fixed' THEN 1 ELSE 0 END)<>7 OR SUM(CASE WHEN p.kind='custom' THEN 1 ELSE 0 END)>200; SELECT session_id FROM custom_categories GROUP BY session_id HAVING SUM(CASE WHEN builtin_key IS NOT NULL THEN 1 ELSE 0 END)<>4; SELECT category_id FROM category_extensions GROUP BY category_id HAVING count(*)>50";
  const db = cli('d1-environment', ['d1', 'execute', 'file-uploader-demo', '--remote', '--command', sql, '--json'], true);
  assert(db.every(item => item.success));
  for (const name of ['0001_initial.sql', '0002_budget.sql', '0003_sessions.sql', '0004_categories.sql', '0005_editable_builtin_categories.sql']) assert(db[0].results.some(row => row.name === name));
  for (const name of ['anonymous_sessions', 'session_extension_policies', 'custom_categories', 'category_extensions', 'upload_budget']) assert(db[1].results.some(row => row.name === name));
  assert.equal(db[2].results.length, 0);
  for (const index of [4, 5, 6]) assert.equal(db[index].results.length, 0);
  const budget = db[3].results[0]; assert.equal(budget.id, 1);
  assert(budget.reserved_bytes >= 0 && budget.reserved_bytes <= 256 * 1024 * 1024 && budget.reserved_puts >= 0 && budget.reserved_puts <= 500);
  const before = JSON.parse(readFileSync(prefix + '-d1-before.json', 'utf8'))[1].results[0];
  assert(budget.reserved_bytes >= before.reserved_bytes && budget.reserved_puts >= before.reserved_puts);
  report.budgetBeforeOperations = budget; report.checks.migrationsSchemaForeignKeysAndInvariants = true;
  const bucket = cli('r2-after', ['r2', 'bucket', 'info', 'file-uploader-demo', '--json'], true); assert.equal(bucket.name, 'file-uploader-demo');
  assert.match(cli('r2-private-after', ['r2', 'bucket', 'dev-url', 'get', 'file-uploader-demo']), /Public access via the r2\.dev URL is disabled/);
  assert.match(cli('r2-domains-after', ['r2', 'bucket', 'domain', 'list', 'file-uploader-demo']), /There are no custom domains connected/);
  report.checks.privateR2Accessible = true;

  const response = await fetch(baseURL + '/', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type') ?? '', /text\/html/); assert.equal(new URL(response.url).origin, baseURL);
  const html = await response.text(); const localHTML = readFileSync('dist/client/index.html', 'utf8');
  const assets = [...localHTML.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map(m => m[1]); assert(assets.length >= 2);
  report.assets = [];
  for (const path of assets) {
    assert(html.includes(path));
    const asset = await fetch(baseURL + path, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type') ?? '', path.endsWith('.css') ? /text\/css/ : /javascript/);
    const remote = Buffer.from(await asset.arrayBuffer()), local = readFileSync('dist/client' + path);
    assert.deepEqual(remote, local);
    report.assets.push({ path, bytes: remote.length, sha256: createHash('sha256').update(remote).digest('hex') });
  }
  const missing = await fetch(baseURL + '/api/release-environment-not-found', { signal: AbortSignal.timeout(15000) });
  assert.equal(missing.status, 404); assert.equal(missing.headers.get('cache-control'), 'no-store'); assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  report.checks.httpsHTMLAndExactBuiltAssetsAndAPIRouting = true; report.result = 'passed';
} catch (error) {
  report.error = String(error.message ?? error); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString(); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, report: output, checks: report.checks, error: report.error }));
}
