import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const files = [...new Set([...git(['diff', '--name-only']).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean))].sort();
const issues = [];
for (const file of files) {
  if (!/^(?:\.docs\/|AGENTS\.md$|README\.md$|server\/|src\/|shared\/|tests\/|migrations\/|vite\.config\.ts$|playwright\.remote\.config\.ts$)/.test(file)) issues.push({ file, reason: 'unexpected path' });
  if (/(?:^|\/)(?:node_modules|\.wrangler|dist|\.pnpm-store)(?:\/|$)|(?:^|\/)(?:\.env|\.dev\.vars)(?:\.|$)|\.(?:sqlite|sqlite3|db|bin|zip|har)$/.test(file)) issues.push({ file, reason: 'local/private generated data' });
  if (!file.endsWith('.png')) {
    const text = readFileSync(file, 'utf8');
    for (const [name, pattern] of [
      ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
      ['literal session token', /uploader_session=[a-f0-9]{64}/],
      ['literal credential assignment', /(?:oauth_token|refresh_token|CLOUDFLARE_API_TOKEN)\s*[=:]\s*["'][A-Za-z0-9_\-/+.]{20,}["']/i],
    ]) if (pattern.test(text)) issues.push({ file, reason: name });
  }
}
const baseline = JSON.parse(readFileSync('.docs/verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/report.json', 'utf8'));
assert.equal(baseline.result, 'passed');
const rehearsal = JSON.parse(readFileSync('.docs/verification/RELEASE-20261023-rehearsal-browser.json', 'utf8'));
assert.equal(rehearsal.result, 'passed'); assert.equal(rehearsal.requests.stored, 2);
const source = files.filter(file => /^(server|src|shared|migrations|tests)\//.test(file) || /config\.ts$/.test(file)).map(file => ({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }));
const report = { checkedAt: new Date().toISOString(), branch: git(['branch', '--show-current']), headBeforeCommit: git(['rev-parse', 'HEAD']), originDelta: git(['rev-list', '--left-right', '--count', 'HEAD...origin/main']), files: files.length, bytes: files.reduce((n, file) => n + statSync(file).size, 0), baseline: baseline.runId, localRehearsal: rehearsal.result, source, issues, result: issues.length ? 'failed' : 'passed' };
writeFileSync('.docs/verification/RELEASE-20261023-precommit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ files: report.files, bytes: report.bytes, result: report.result, issues }));
if (issues.length) process.exitCode = 1;
