import { env, exports } from 'cloudflare:workers';
import { beforeEach, expect, it, vi, afterEach } from 'vitest';
import { migrate, createSession, sessionId } from './fixtures';
import { FIXED, LIMITS } from '../../shared/rules';

beforeEach(migrate);
afterEach(() => vi.restoreAllMocks());
const api = (cookie: string, path = '/api/policies', method = 'GET', body?: unknown) => exports.default.fetch('https://example.test' + path, {
  method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body),
});
it('SESSION: creates private unchecked defaults; cookie re-entry preserves DB state and old global data is ignored', async () => {
  await env.DB.prepare("UPDATE extension_policies SET blocked=1").run();
  const { cookie, response } = await createSession();
  expect(response.headers.get('set-cookie')).toMatch(/; HttpOnly; SameSite=Lax; Path=\/api; Secure$/);
  expect(response.headers.get('set-cookie')).not.toMatch(/Expires|Max-Age|Domain/i);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(JSON.stringify(await response.json())).not.toContain(cookie.split('=')[1]);
  const data = await (await api(cookie)).json<any>();
  expect(data.fixed.map((p: any) => p.extension).sort()).toEqual([...FIXED].sort());
  expect(data.fixed.every((p: any) => !p.blocked)).toBe(true);
  expect(data.customCount).toBe(0);
  expect((await api(cookie, '/api/policies/fixed/exe', 'PATCH', { blocked: true })).status).toBe(200);
  expect((await api(cookie, '/api/policies/custom', 'POST', { extension: 'zip' })).status).toBe(201);
  const resumed = await createSession(cookie);
  expect(resumed.response.headers.get('set-cookie')).toBeNull();
  const reread = await (await api(cookie)).json<any>();
  expect(reread.fixed.find((p: any) => p.extension === 'exe').blocked).toBe(true);
  expect(reread.customCount).toBe(1);
  expect(await env.DB.prepare('SELECT count(*) AS n FROM anonymous_sessions').first('n')).toBe(1);
});
it('SESSION: isolates all CRUD, duplicate checks and the atomic 200-custom limit', async () => {
  const a = (await createSession()).cookie, b = (await createSession()).cookie;
  expect(a).not.toBe(b);
  await api(a, '/api/policies/fixed/exe', 'PATCH', { blocked: true });
  await api(a, '/api/policies/custom', 'POST', { extension: 'zip' });
  expect((await api(b, '/api/policies/custom', 'POST', { extension: 'zip' })).status).toBe(201);
  await api(a, '/api/policies/custom/zip', 'DELETE');
  expect((await (await api(b)).json<any>()).custom.map((p: any) => p.extension)).toEqual(['zip']);
  const id = await sessionId(a);
  await env.DB.batch(Array.from({ length: 199 }, (_, i) => env.DB.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'custom',1)").bind(id, 'x' + i)));
  const responses = await Promise.all(['one', 'two'].map(extension => api(a, '/api/policies/custom', 'POST', { extension })));
  expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  expect((await api(b, '/api/policies/custom', 'POST', { extension: 'another' })).status).toBe(201);
  const data = await (await api(b)).json<any>();
  expect(data.fixed.every((p: any) => !p.blocked)).toBe(true);
  expect(data.customCount).toBe(2);
});
it('SESSION: applies each cookie policy to real R2 storage and keeps the app budget global', async () => {
  const a = (await createSession()).cookie, b = (await createSession()).cookie;
  await api(a, '/api/policies/fixed/exe', 'PATCH', { blocked: true });
  const send = (cookie: string) => {
    const form = new FormData(); form.set('file', new File(['session-bytes'], 'sample.exe'));
    return exports.default.fetch('https://example.test/api/uploads', { method: 'POST', headers: { cookie }, body: form });
  };
  expect((await send(a)).status).toBe(422);
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
  const allowed = await send(b);
  expect(allowed.status).toBe(201);
  const { id } = await allowed.json<any>();
  expect(await (await env.UPLOADS.get('uploads/' + id))!.text()).toBe('session-bytes');
  await env.DB.prepare('UPDATE upload_budget SET reserved_puts=?').bind(LIMITS.puts).run();
  const c = (await createSession()).cookie;
  expect((await send(c)).status).toBe(503);
  expect((await env.UPLOADS.list()).objects).toHaveLength(1);
});
it('SESSION: missing, malformed and unissued cookies cannot read, edit or upload', async () => {
  for (const cookie of ['', 'uploader_session=wrong', 'uploader_session=' + 'f'.repeat(64), 'uploader_session=' + 'f'.repeat(64) + '; uploader_session=' + 'a'.repeat(64)]) {
    expect((await api(cookie)).status).toBe(401);
    expect((await api(cookie, '/api/policies/fixed/exe', 'PATCH', { blocked: true })).status).toBe(401);
    expect((await api(cookie, '/api/uploads', 'POST')).status).toBe(401);
  }
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
  const { cookie } = await createSession('uploader_session=' + 'f'.repeat(64), 'http://example.test');
  expect(cookie).not.toContain('f'.repeat(64));
  const local = await createSession(undefined, 'http://127.0.0.1:5173');
  expect(local.response.headers.get('set-cookie')).not.toContain('Secure');
});
it('SESSION: new identity is not a fallback for broken policy rows and cross-origin creation is denied', async () => {
  const { cookie } = await createSession();
  const id = await sessionId(cookie);
  await env.DB.prepare("DELETE FROM session_extension_policies WHERE session_id=? AND extension='exe'").bind(id).run();
  expect((await api(cookie)).status).toBe(503);
  await createSession(cookie);
  expect((await api(cookie)).status).toBe(503);
  expect((await exports.default.fetch('https://example.test/api/session', { method: 'POST', headers: { origin: 'https://other.test' } })).status).toBe(403);
});
it('SESSION: session and seven defaults roll back together when local D1 rejects initialization', async () => {
  await env.DB.exec("CREATE TRIGGER fail_session_seed BEFORE INSERT ON session_extension_policies WHEN NEW.extension='exe' BEGIN SELECT RAISE(ABORT, 'test initialization failure'); END");
  const response = await exports.default.fetch('https://example.test/api/session', { method: 'POST' });
  expect(response.status).toBe(503);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await env.DB.prepare('SELECT count(*) AS n FROM anonymous_sessions').first('n')).toBe(0);
  expect(await env.DB.prepare('SELECT count(*) AS n FROM session_extension_policies').first('n')).toBe(0);
});
