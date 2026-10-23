import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const prefix = '.docs/verification/RELEASE-20261023';
const ledger = JSON.parse(readFileSync('.wrangler/release/RELEASE-20261023-ledger.json', 'utf8'));
const environment = JSON.parse(readFileSync(prefix + '-environment.json', 'utf8'));
assert.equal(environment.result, 'passed'); assert.equal(environment.stage, 'post-deploy');
assert.equal(ledger.uploads.length, 2); assert.equal(ledger.sessions.length, 2);
assert(ledger.sessions.every(id => /^[0-9a-f]{64}$/.test(id)));
assert(ledger.uploads.every(item => /^[0-9a-f-]{36}$/.test(item.id) && item.size > 0 && item.size <= 128));
const report = { checkedAt: new Date().toISOString(), result: 'failed', uploads: [], budgetRefunded: false, cleanup: {} };
function cli(args) { return execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }); }
try {
  mkdirSync('.wrangler/release/objects', { recursive: true });
  for (const expected of ledger.uploads) {
    const path = resolve('.wrangler/release/objects', expected.id + '.bin');
    writeFileSync(prefix + '-r2-get-' + expected.id + '.log', cli(['r2', 'object', 'get', 'file-uploader-demo/uploads/' + expected.id, '--remote', '--file', path]));
    const bytes = readFileSync(path); const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.equal(bytes.length, expected.size); assert.equal(sha256, expected.sha256); assert.equal(bytes.toString(), expected.content);
    report.uploads.push({ id: expected.id, bytes: bytes.length, expectedSha256: expected.sha256, actualSha256: sha256, match: true });
    unlinkSync(path);
  }
  const ids = ledger.sessions.map(id => "'" + id + "'").join(',');
  const before = JSON.parse(cli(['d1', 'execute', 'file-uploader-demo', '--remote', '--command', `SELECT id,reserved_bytes,reserved_puts FROM upload_budget; SELECT s.id,count(p.extension) AS policy_count,sum(CASE WHEN p.kind='custom' THEN 1 ELSE 0 END) AS custom_count FROM anonymous_sessions s LEFT JOIN session_extension_policies p ON p.session_id=s.id WHERE s.id IN (${ids}) GROUP BY s.id; SELECT count(*) AS n FROM custom_categories WHERE session_id IN (${ids})`, '--json']));
  assert(before.every(item => item.success)); assert.equal(before[1].results.length, 2);
  for (const row of before[1].results) { assert.equal(row.policy_count, 7); assert.equal(row.custom_count, 0); }
  assert.equal(before[2].results[0].n, 8);
  const budget = before[0].results[0], baseline = environment.budgetBeforeOperations;
  const totalBytes = ledger.uploads.reduce((n, file) => n + file.size, 0);
  assert(budget.reserved_bytes >= baseline.reserved_bytes + totalBytes); assert(budget.reserved_puts >= baseline.reserved_puts + 2);
  report.budget = { baseline, beforeCleanup: budget, minimumExpectedBytesIncrease: totalBytes, minimumExpectedPutsIncrease: 2, exactExpectedDeltaObserved: budget.reserved_bytes === baseline.reserved_bytes + totalBytes && budget.reserved_puts === baseline.reserved_puts + 2 };
  writeFileSync(prefix + '-d1-operational.json', JSON.stringify(before, null, 2) + '\n');
  // Only keys returned to this run and two cryptographically identified sessions are removed.
  let cleanupLog = '';
  for (const file of ledger.uploads) cleanupLog += cli(['r2', 'object', 'delete', 'file-uploader-demo/uploads/' + file.id, '--remote']);
  writeFileSync(prefix + '-cleanup-r2.log', cleanupLog);
  const cleanup = JSON.parse(cli(['d1', 'execute', 'file-uploader-demo', '--remote', '--command', `DELETE FROM anonymous_sessions WHERE id IN (${ids}); SELECT count(*) AS n FROM anonymous_sessions WHERE id IN (${ids}); SELECT count(*) AS n FROM session_extension_policies WHERE session_id IN (${ids}); SELECT count(*) AS n FROM custom_categories WHERE session_id IN (${ids}); PRAGMA foreign_key_check; SELECT id,reserved_bytes,reserved_puts FROM upload_budget`, '--json']));
  assert(cleanup.every(item => item.success));
  for (const index of [1, 2, 3]) assert.equal(cleanup[index].results[0].n, 0);
  assert.equal(cleanup[4].results.length, 0);
  assert(cleanup[5].results[0].reserved_bytes >= budget.reserved_bytes && cleanup[5].results[0].reserved_puts >= budget.reserved_puts);
  writeFileSync(prefix + '-cleanup-d1.json', JSON.stringify(cleanup, null, 2) + '\n');
  report.cleanup = { ownObjectsDeleted: ledger.uploads.map(file => file.id), ownSessionsDeleted: 2, policyAndCategoryCascadeVerified: true, foreignKeyViolations: 0, localBodiesRemoved: true };
  report.result = 'passed';
} catch (error) { report.error = String(error.message ?? error); process.exitCode = 1; }
finally { writeFileSync(prefix + '-storage.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
