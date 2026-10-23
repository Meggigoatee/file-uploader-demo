import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const output = '.docs/verification/SUBMISSION-20261023-check.json';
const required = ['README.md', 'SUBMISSION.md', 'CONSIDERATIONS.md', 'PROMPT_LOG.md', 'SCHEMA.md', 'schema.sql'];
const report = { checkedAt: new Date().toISOString(), scope: 'submission documents and in-memory SQL only; no app or operational test', result: 'failed', required, checks: {} };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const combined = new DatabaseSync(':memory:'), migrated = new DatabaseSync(':memory:');
try {
  for (const file of required) assert(existsSync(file), file + ' is missing');
  const names = readdirSync('migrations').filter(name => name.endsWith('.sql')).sort();
  assert.equal(names.length, 5);
  const sources = names.map(name => ({ name, sql: readFileSync('migrations/' + name, 'utf8').replace(/\r\n/g, '\n') }));
  const sql = readFileSync('schema.sql', 'utf8');
  for (const source of sources) assert(sql.includes('-- source: migrations/' + source.name + '\n' + source.sql.trimEnd() + '\n'));
  combined.exec('PRAGMA foreign_keys=ON;'); migrated.exec('PRAGMA foreign_keys=ON;');
  combined.exec(sql); for (const source of sources) migrated.exec(source.sql);
  const snapshot = db => db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  assert.deepEqual(snapshot(combined), snapshot(migrated));
  const tables = snapshot(combined).filter(row => row.type === 'table').map(row => row.name);
  assert.equal(tables.length, 6);
  const indexes = tables.flatMap(table => combined.prepare('PRAGMA index_list("' + table + '")').all().map(index => ({ table, name: index.name, unique: index.unique, origin: index.origin, columns: combined.prepare('PRAGMA index_info("' + index.name + '")').all().map(column => column.name) })));
  assert(indexes.some(index => index.name === 'category_builtin_per_session' && index.unique === 1));
  assert.equal(combined.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.equal(combined.prepare('SELECT count(*) AS n FROM extension_policies').get().n, 7);
  assert.equal(combined.prepare('SELECT count(*) AS n FROM anonymous_sessions').get().n, 0);
  assert.equal(combined.prepare('SELECT count(*) AS n FROM session_extension_policies').get().n, 0);
  assert.deepEqual({ ...combined.prepare('SELECT id,reserved_bytes,reserved_puts FROM upload_budget').get() }, { id: 1, reserved_bytes: 0, reserved_puts: 0 });
  report.schema = { matchesMigrations: true, tables, indexes, foreignKeyViolations: 0, sqlSha256: hash(sql), sourceFiles: sources.map(source => ({ file: 'migrations/' + source.name, sha256: hash(source.sql) })) };
  report.checks.sqlSyntaxAndFinalSchemaMatch = true;

  const documents = ['README.md', 'AGENTS.md', ...required.filter(file => file.endsWith('.md') && file !== 'README.md')];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file); else if (entry.name.endsWith('.md')) documents.push(file);
    }
  }
  walk('.docs'); walk('.agents/skills');
  let localLinks = 0, anchors = 0;
  const broken = [], historicalRootReferences = [];
  const slug = value => value.toLowerCase().replace(/<[^>]*>/g, '').replace(/[*`_]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
  for (const file of documents) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1].replace(/^<|>$/g, '');
      if (/^(https?:|mailto:|plugin:|app:|codex:)/i.test(href)) continue;
      const [pathname, anchor] = href.split('#');
      let target = pathname ? path.resolve(path.dirname(file), decodeURIComponent(pathname)) : path.resolve(file);
      localLinks++;
      if (!existsSync(target) && file.includes('conversations') && pathname.startsWith('.docs/') && existsSync(path.resolve(pathname))) {
        historicalRootReferences.push({ file, href }); target = path.resolve(pathname);
      }
      if (!existsSync(target)) { broken.push({ file, href, reason: 'missing path' }); continue; }
      if (anchor && target.endsWith('.md')) {
        anchors++;
        const headings = [...readFileSync(target, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(item => slug(item[1].trim()));
        if (!headings.includes(decodeURIComponent(anchor))) broken.push({ file, href, reason: 'missing heading' });
      }
    }
  }
  report.links = { documents: documents.length, localLinks, anchors, broken, historicalRootReferences };
  assert.equal(broken.length, 0, JSON.stringify(broken)); report.checks.localLinksAndAnchors = true;

  const rootText = required.filter(file => file.endsWith('.md')).map(file => readFileSync(file, 'utf8')).join('\n');
  for (const word of ['GitHub', 'CONSIDERATIONS.md', 'PROMPT_LOG.md', 'SCHEMA.md', 'schema.sql', 'pnpm install --frozen-lockfile', 'pnpm run db:local', 'pnpm run dev', 'pnpm run check', '미구현', '채택', '수정', '폐기', '인덱스']) assert(rootText.includes(word), word + ' coverage is missing');
  const run = '.docs/verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/';
  assert.equal(JSON.parse(readFileSync(run + 'report.json', 'utf8')).result, 'passed');
  for (const [file, count] of [['test-unit.txt', 65], ['test-integration.txt', 57]]) assert.match(readFileSync(run + file, 'utf8').replace(/\x1b\[[0-9;]*m/g, ''), new RegExp('Tests\\s+' + count + ' passed'));
  assert.match(readFileSync(run + 'test-e2e.txt', 'utf8').replace(/\x1b\[[0-9;]*m/g, ''), /29 passed/);
  const operational = JSON.parse(readFileSync('.docs/verification/RELEASE-20261023-browser.json', 'utf8'));
  const storage = JSON.parse(readFileSync('.docs/verification/RELEASE-20261023-storage.json', 'utf8'));
  assert.equal(operational.result, 'passed'); assert.equal(operational.requests.stored, 2);
  assert.equal(storage.result, 'passed'); assert.equal(storage.uploads.length, 2); assert(storage.uploads.every(item => item.match && item.bytes === 28));
  report.checks.requiredItemsAndExistingEvidence = true;
  const protectedPaths = ['.docs/과제_파일업로드_AI개발.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', ...names.map(name => 'migrations/' + name)];
  report.protected = protectedPaths.map(file => ({ file, unchanged: hash(execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }).replace(/\r\n/g, '\n')) === hash(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')) }));
  assert(report.protected.every(file => file.unchanged)); report.checks.originalDependenciesAndMigrationsUnchanged = true;
  report.result = 'passed';
} catch (error) { report.error = String(error.message ?? error); process.exitCode = 1; }
finally {
  combined.close(); migrated.close(); report.finishedAt = new Date().toISOString();
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, report: output, checks: report.checks, links: report.links, error: report.error }, null, 2));
}
