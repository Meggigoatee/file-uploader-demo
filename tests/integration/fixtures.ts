import { env, exports } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { expect } from 'vitest';

const migrations = import.meta.glob('../../migrations/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
export async function migrate() {
  await reset();
  await applyD1Migrations(env.DB, Object.entries(migrations).sort().map(([name, sql]) => ({ name, queries: sql.split(';').map(s => s.trim()).filter(Boolean) })));
}
export async function createSession(cookie?: string, origin = 'https://example.test') {
  const response = await exports.default.fetch(origin + '/api/session', { method: 'POST', headers: cookie ? { cookie } : {} });
  expect(response.status).toBe(200);
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie! };
}
export const sessionId = async (cookie: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cookie.split('=')[1])))].map(b => b.toString(16).padStart(2, '0')).join('');
