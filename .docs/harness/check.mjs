// A small local command runner; application tests remain in their own tools.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const appScripts = ['typecheck', 'build', 'test:unit', 'test:integration', 'test:e2e'];
const missingScripts = appScripts.filter((name) => !manifest.scripts?.[name]);
const mode = process.argv[2];

if (mode === '--list' && process.argv.length === 3) {
  console.log(JSON.stringify({
    environment: { command: 'pnpm run check:env', scope: 'development tools only' },
    app: { command: 'pnpm run check', scripts: appScripts, missingScripts },
  }, null, 2));
  process.exit(0);
}
if (!['environment', 'app'].includes(mode) || process.argv.length !== 3) {
  console.error('Usage: node .docs/harness/check.mjs environment|app|--list');
  process.exit(2);
}

const runId = `CHECK-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const directory = join(root, '.docs/verification/runs', runId);
mkdirSync(directory, { recursive: true });
const report = { runId, mode, startedAt: new Date().toISOString(), node: process.version, result: 'running', steps: [] };

function run(name, args) {
  console.log(`Running ${name}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    encoding: 'utf8',
    shell: false,
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const logFile = `${name.replaceAll(':', '-')}.txt`;
  writeFileSync(join(directory, logFile), `${stdout}${stderr}${result.error ? `\n${result.error.message}\n` : ''}`);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  report.steps.push({
    name,
    command: [process.execPath, ...args],
    result: result.status === 0 && !result.error ? 'passed' : 'failed',
    exitCode: result.status,
    signal: result.signal,
    logFile,
    ...(result.error ? { error: result.error.message } : {}),
  });
  if (result.status !== 0 || result.error) {
    throw new Error(`${name} failed; see ${logFile}`);
  }
}

try {
  if (mode === 'environment') {
    run('environment', [join(root, '.docs/verification/check-environment.mjs'), join(directory, 'environment.json')]);
    report.result = 'passed';
  } else if (missingScripts.length) {
    report.result = 'blocked';
    report.reason = 'Application check scripts are not configured yet.';
    report.missingScripts = missingScripts;
    process.exitCode = 2;
  } else {
    const pnpmCli = process.env.npm_execpath;
    if (!pnpmCli || !/pnpm\.(?:cjs|mjs|js)$/i.test(pnpmCli) || !existsSync(pnpmCli)) {
      report.result = 'blocked';
      report.reason = 'Run through pnpm run check so the existing pnpm CLI can be reused.';
      process.exitCode = 2;
    } else {
      for (const name of appScripts) run(name, [pnpmCli, 'run', name]);
      report.result = 'passed';
    }
  }
} catch (error) {
  report.result = 'failed';
  report.reason = error.message;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.result}: ${relative(root, join(directory, 'report.json'))}`);
  if (report.reason) console.log(report.reason);
}
