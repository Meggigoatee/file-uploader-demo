import { env, exports } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { migrate, createSession, sessionId } from './fixtures';

beforeEach(migrate);
const api = (cookie: string, path = '', method = 'GET', body?: unknown) => exports.default.fetch('https://example.test/api/policies/categories' + path, { method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
const groups = async (cookie: string) => (await (await api(cookie)).json<any>()).categories;
const policy = async (cookie: string) => (await exports.default.fetch('https://example.test/api/policies', { headers: { cookie } })).json<any>();

it('CATEGORY-03: editable builtin membership persists and bulk action uses every current member', async () => {
  const a = (await createSession()).cookie, b = (await createSession()).cookie;
  expect((await api(a, '/photos/extensions', 'POST', { extension: '.HEIC' })).status).toBe(201);
  expect((await api(a, '/photos/extensions', 'POST', { extension: 'heic' })).status).toBe(409);
  expect((await api(a, '/photos/extensions/png', 'DELETE')).status).toBe(204);
  await createSession(a);
  const photos = (await groups(a)).find((c: any) => c.id === 'photos');
  expect(photos.extensions).toContain('heic'); expect(photos.extensions).not.toContain('png');
  expect((await groups(b)).find((c: any) => c.id === 'photos').extensions).toContain('png');
  expect((await policy(a)).customCount).toBe(0);
  expect((await api(a, '/photos/state', 'PATCH', { blocked: true })).status).toBe(200);
  const data = await policy(a);
  expect(data.custom.map((p: any) => p.extension).sort()).toEqual(photos.extensions.slice().sort());
  const send = (name: string) => { const form = new FormData(); form.set('file', new File(['category-edited-bytes'], name)); return exports.default.fetch('https://example.test/api/uploads', { method: 'POST', headers: { cookie: a }, body: form }); };
  expect((await send('image.heic')).status).toBe(422);
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
  const stored = await send('image.png'); expect(stored.status).toBe(201);
  const { id } = await stored.json<any>(); expect(await (await env.UPLOADS.get('uploads/' + id))!.text()).toBe('category-edited-bytes');
  expect((await api(a, '/photos/extensions/heic', 'DELETE')).status).toBe(204);
  expect((await policy(a)).custom.some((p: any) => p.extension === 'heic')).toBe(true);
});

it('CATEGORY-03: name-only create/rename preserves membership and enforces scoped additions atomically', async () => {
  const { cookie } = await createSession();
  const created = await api(cookie, '', 'POST', { name: '개발' }); expect(created.status).toBe(201);
  const group = await created.json<any>(); expect(group.extensions).toEqual([]);
  expect((await api(cookie, '/' + group.id + '/extensions', 'POST', { extension: 'exe' })).status).toBe(201);
  expect((await api(cookie, '/' + group.id, 'PUT', { name: '도구' })).status).toBe(200);
  expect((await groups(cookie)).find((c: any) => c.id === group.id)).toMatchObject({ name: '도구', extensions: ['exe'] });
  const other = (await createSession()).cookie;
  expect((await api(other, '/' + group.id + '/extensions', 'POST', { extension: 'zip' })).status).toBe(404);
  for (const extension of ['', 'bad.ext', 'a'.repeat(21)]) expect((await api(cookie, '/' + group.id + '/extensions', 'POST', { extension })).status).toBe(400);
  const id = await sessionId(cookie);
  const internal = await env.DB.prepare('SELECT id FROM custom_categories WHERE session_id=? AND id=?').bind(id, group.id).first<string>('id');
  await env.DB.batch(Array.from({ length: 48 }, (_, i) => env.DB.prepare('INSERT INTO category_extensions(category_id,extension) VALUES (?,?)').bind(internal, 'x' + i)));
  const results = await Promise.all(['one','two'].map(extension => api(cookie, '/' + group.id + '/extensions', 'POST', { extension })));
  expect(results.map(r => r.status).sort()).toEqual([201,409]);
  expect((await groups(cookie)).find((c: any) => c.id === group.id).extensions).toHaveLength(50);
});

it('CATEGORY-03: migration backfills builtin members for old sessions without changing custom groups or policies', async () => {
  await reset();
  const all = import.meta.glob('../../migrations/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string,string>;
  const before = Object.entries(all).filter(([file]) => !file.includes('0005')).sort();
  await applyD1Migrations(env.DB, before.map(([name, sql]) => ({ name, queries: sql.split(';').map(s => s.trim()).filter(Boolean) })));
  const id = 'a'.repeat(64);
  await env.DB.prepare('INSERT INTO anonymous_sessions(id) VALUES (?)').bind(id).run();
  await env.DB.prepare('INSERT INTO custom_categories(id,session_id,name) VALUES (?,?,?)').bind('old-group',id,'기존 분류').run();
  await env.DB.prepare("INSERT INTO category_extensions(category_id,extension) VALUES ('old-group','zip')").run();
  const after = Object.entries(all).filter(([file]) => file.includes('0005'));
  if (after.length) await applyD1Migrations(env.DB, after.map(([name, sql]) => ({ name, queries: sql.split(';').map(s => s.trim()).filter(Boolean) })));
  expect(await env.DB.prepare('SELECT count(*) AS n FROM custom_categories WHERE session_id=?').bind(id).first('n')).toBe(5);
  expect(await env.DB.prepare("SELECT extension FROM category_extensions WHERE category_id='old-group'").first('extension')).toBe('zip');
  expect(await env.DB.prepare('SELECT count(*) AS n FROM session_extension_policies').first('n')).toBe(0);
});
