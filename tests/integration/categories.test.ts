import { env, exports } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { migrate, createSession, sessionId } from './fixtures';

beforeEach(migrate);
const api = (cookie: string, path = '', method = 'GET', body?: unknown) => exports.default.fetch('https://example.test/api/policies/categories' + path, {
  method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body),
});
const policies = async (cookie: string) => (await exports.default.fetch('https://example.test/api/policies', { headers: { cookie } })).json<any>();
const create = async (cookie: string, name = '개발', extensions = ['exe', 'pdf', 'zip']) => {
  const response = await api(cookie, '', 'POST', { name, extensions });
  expect(response.status).toBe(201);
  return response.json<any>();
};

it('CATEGORY: returns four builtin guides with five extensions each and no policy writes', async () => {
  const { cookie } = await createSession();
  const response = await api(cookie);
  expect(response.status).toBe(200);
  const { categories } = await response.json<any>();
  expect(categories).toHaveLength(4);
  expect(categories.every((c: any) => c.builtin && c.extensions.length === 5 && new Set(c.extensions).size === 5)).toBe(true);
  expect((await policies(cookie)).customCount).toBe(0);
});
it('CATEGORY: persists normalized editable membership and isolates names/ids by session', async () => {
  const a = (await createSession()).cookie, b = (await createSession()).cookie;
  const group = await create(a, ' 개발 ', ['.PDF', 'pdf', 'exe']);
  expect(group).toMatchObject({ name: '개발', extensions: ['exe', 'pdf'], builtin: false });
  expect((await api(a, '', 'POST', { name: '개발', extensions: [] })).status).toBe(409);
  expect((await api(a, '/' + group.id, 'PUT', { name: '개발 도구', extensions: ['js', 'zip'] })).status).toBe(200);
  expect((await (await api(a)).json<any>()).categories.find((c: any) => c.id === group.id)).toMatchObject({ name: '개발 도구', extensions: ['js', 'zip'] });
  expect((await (await api(b)).json<any>()).categories).toHaveLength(4);
  expect((await api(b, '/' + group.id, 'DELETE')).status).toBe(404);
  expect((await api(b, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(404);
  await create(b, '개발');
  for (const body of [{ name: '', extensions: [] }, { name: 'x', extensions: ['bad.ext'] }, { name: 'x', extensions: Array.from({ length: 51 }, (_, i) => 'e' + i) }, { name: '사진', extensions: [] }, { name: 'x', extensions: [], extra: 1 }]) {
    expect((await api(a, '', 'POST', body)).status).toBe(400);
  }
});
it('CATEGORY: bulk block/allow updates fixed and custom policies without hidden category state', async () => {
  const { cookie } = await createSession();
  const group = await create(cookie);
  expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
  let data = await policies(cookie);
  expect(data.fixed.find((p: any) => p.extension === 'exe').blocked).toBe(true);
  expect(data.custom.map((p: any) => p.extension)).toEqual(['pdf', 'zip']);
  expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
  expect((await policies(cookie)).customCount).toBe(2);
  expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: false })).status).toBe(200);
  data = await policies(cookie);
  expect(data.fixed.every((p: any) => !p.blocked)).toBe(true);
  expect(data.customCount).toBe(0);
  expect((await (await api(cookie)).json<any>()).categories.find((c: any) => c.id === group.id).extensions).toHaveLength(3);
});
it('CATEGORY: reaching the 200 limit rejects the entire batch including fixed updates', async () => {
  const { cookie } = await createSession(); const id = await sessionId(cookie);
  const group = await create(cookie);
  await env.DB.batch(Array.from({ length: 199 }, (_, i) => env.DB.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'custom',1)").bind(id, 'x' + i)));
  const denied = await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true });
  expect(denied.status).toBe(409);
  expect(await denied.json<any>()).toMatchObject({ error: { code: 'CUSTOM_LIMIT_REACHED' } });
  const before = await policies(cookie);
  expect(before.customCount).toBe(199); expect(before.fixed.find((p: any) => p.extension === 'exe').blocked).toBe(false);
  await env.DB.prepare("DELETE FROM session_extension_policies WHERE session_id=? AND extension='x0'").bind(id).run();
  expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
  expect((await policies(cookie)).customCount).toBe(200);
});
it('CATEGORY: concurrent bulk requests share one DB limit and never partially apply', async () => {
  const { cookie } = await createSession(); const id = await sessionId(cookie);
  const a = await create(cookie, 'A', ['exe', 'one']), b = await create(cookie, 'B', ['cmd', 'two']);
  await env.DB.batch(Array.from({ length: 199 }, (_, i) => env.DB.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'custom',1)").bind(id, 'x' + i)));
  const responses = await Promise.all([a, b].map(c => api(cookie, '/' + c.id + '/state', 'PATCH', { blocked: true })));
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  const data = await policies(cookie);
  expect(data.customCount).toBe(200);
  expect(data.fixed.filter((p: any) => p.blocked)).toHaveLength(1);
  expect(data.fixed.find((p: any) => p.extension === 'exe').blocked).toBe(data.custom.some((p: any) => p.extension === 'one'));
});
it('CATEGORY: deletion allows all members and transaction failure keeps group and policies intact', async () => {
  const { cookie } = await createSession(); const group = await create(cookie);
  await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true });
  await env.DB.exec("CREATE TRIGGER reject_category_delete BEFORE DELETE ON custom_categories BEGIN SELECT RAISE(ABORT, 'local rollback fixture'); END");
  expect((await api(cookie, '/' + group.id, 'DELETE')).status).toBe(503);
  expect((await policies(cookie)).customCount).toBe(2);
  expect((await policies(cookie)).fixed.find((p: any) => p.extension === 'exe').blocked).toBe(true);
  await env.DB.exec('DROP TRIGGER reject_category_delete');
  expect((await api(cookie, '/' + group.id, 'DELETE')).status).toBe(204);
  expect((await policies(cookie)).customCount).toBe(0);
  expect((await policies(cookie)).fixed.every((p: any) => !p.blocked)).toBe(true);
  expect((await (await api(cookie)).json<any>()).categories).toHaveLength(4);
  expect(await env.DB.prepare('SELECT count(*) AS n FROM category_extensions WHERE category_id=?').bind(group.id).first('n')).toBe(0);
});
it('CATEGORY: builtin batch actually blocks uploads and allow stores exact R2 bytes', async () => {
  const { cookie } = await createSession();
  expect((await api(cookie, '/documents/state', 'PATCH', { blocked: true })).status).toBe(200);
  const send = () => { const form = new FormData(); form.set('file', new File(['category-bytes'], 'sample.pdf')); return exports.default.fetch('https://example.test/api/uploads', { method: 'POST', headers: { cookie }, body: form }); };
  expect((await send()).status).toBe(422); expect((await env.UPLOADS.list()).objects).toHaveLength(0);
  expect((await api(cookie, '/documents/state', 'PATCH', { blocked: false })).status).toBe(200);
  const response = await send(); expect(response.status).toBe(201);
  const { id } = await response.json<any>(); expect(await (await env.UPLOADS.get('uploads/' + id))!.text()).toBe('category-bytes');
});

it('CATEGORY: failed membership replacement rolls back, overlapping groups share current extension policies', async () => {
  const { cookie } = await createSession();
  const first = await create(cookie, '첫 그룹', ['pdf', 'exe']);
  const second = await create(cookie, '겹친 그룹', ['pdf']);
  await api(cookie, '/' + first.id + '/state', 'PATCH', { blocked: true });
  await env.DB.exec("CREATE TRIGGER reject_category_member BEFORE INSERT ON category_extensions WHEN NEW.extension='zip' BEGIN SELECT RAISE(ABORT, 'local membership rollback'); END");
  expect((await api(cookie, '/' + first.id, 'PUT', { name: '변경', extensions: ['zip'] })).status).toBe(503);
  const original = (await (await api(cookie)).json<any>()).categories.find((c: any) => c.id === first.id);
  expect(original).toMatchObject({ name: '첫 그룹', extensions: ['exe', 'pdf'] });
  await env.DB.exec('DROP TRIGGER reject_category_member');
  expect((await api(cookie, '/' + first.id, 'DELETE')).status).toBe(204);
  const remaining = (await (await api(cookie)).json<any>()).categories.find((c: any) => c.id === second.id);
  expect(remaining.extensions).toEqual(['pdf']);
  expect((await policies(cookie)).customCount).toBe(0);
  expect((await api(cookie, '/photos', 'DELETE')).status).toBe(400);
  expect((await api(cookie, '/photos/state', 'PATCH', { blocked: 'true' })).status).toBe(400);
});
