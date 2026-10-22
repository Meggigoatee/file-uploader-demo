import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cli = process.env.npm_execpath;
if (!cli) throw new Error('Run through pnpm run test:e2e');
for (const args of [
  ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'file-uploader-demo', '--local', '--persist-to', '.wrangler/e2e'],
  ['exec', 'playwright', 'test', ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, [resolve(cli), ...args], { stdio: 'inherit', shell: false, windowsHide: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
