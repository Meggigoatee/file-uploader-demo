import { env, exports } from 'cloudflare:workers';
import { beforeEach, expect, it, vi, afterEach } from 'vitest';
import { migrate, createSession, sessionId } from './fixtures';
import { upload } from '../../server/uploads';

beforeEach(migrate);
afterEach(() => vi.restoreAllMocks());
const root = 'https://example.test/api/policies/categories';
const api = (cookie: string, path = '', method = 'GET', body?: unknown) => exports.default.fetch(root + path, { method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
const groups = async (cookie: string) => (await (await api(cookie)).json<any>()).categories;
const policies = async (cookie: string) => (await (await exports.default.fetch('https://example.test/api/policies', { headers: { cookie } })).json<any>());
async function create(cookie: string, name: string, extensions: string[] = []) {
  const response = await api(cookie, '', 'POST', { name, extensions });
  expect(response.status).toBe(201);
  return response.json<any>();
}
async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ error: { code }, requestId: expect.any(String) });
}

it('FINAL category: exact name/member limits, raw validation and normalization are enforced by HTTP without writes on rejection', async () => {
  const { cookie } = await createSession();
  const members = Array.from({ length: 50 }, (_, i) => 'x' + i);
  const group = await create(cookie, '가'.repeat(30), members);
  expect(group.extensions).toEqual([...members].sort());
  const before = await groups(cookie);
  for (const body of [{ name: 'a'.repeat(31) }, { name: 'a\nb' }, { name: ' 사진 ' }, { name: 'x', extensions: null }, { name: 'x', extensions: [1] }, { name: 'x', extensions: ['.' + 'a'.repeat(20)] }, { name: 'x', extensions: Array.from({ length: 51 }, () => 'pdf') }, { name: 'x', extra: true }]) {
    await error(await api(cookie, '', 'POST', body), 400, 'INVALID_CATEGORY');
  }
  expect(await groups(cookie)).toEqual(before);
  expect((await policies(cookie)).customCount).toBe(0);
  await error(await api(cookie, '/' + group.id + '/extensions', 'POST', { extension: 'new' }), 409, 'CATEGORY_MEMBER_LIMIT');
  await error(await api(cookie, '/' + group.id + '/extensions', 'POST', { extension: '.X0' }), 409, 'CATEGORY_EXTENSION_EXISTS');
  expect((await api(cookie, '/' + group.id + '/extensions/x0', 'DELETE')).status).toBe(204);
  expect((await api(cookie, '/' + group.id + '/extensions/x0', 'DELETE')).status).toBe(204);
  expect((await api(cookie, '/' + group.id + '/extensions', 'POST', { extension: '. NEW ' })).status).toBe(201);
  expect((await groups(cookie)).find((c: any) => c.id === group.id).extensions).toEqual([...members.slice(1), 'new'].sort());
});

it('FINAL category: concurrent case-insensitive names and normalized members create one scoped row', async () => {
  const { cookie } = await createSession();
  const responses = await Promise.all(['Tools', 'tools'].map(name => api(cookie, '', 'POST', { name })));
  expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  await error(responses.find(r => r.status === 409)!, 409, 'CATEGORY_EXISTS');
  const group = await responses.find(r => r.status === 201)!.json<any>();
  const additions = await Promise.all(['.ZIP', 'zip'].map(extension => api(cookie, '/' + group.id + '/extensions', 'POST', { extension })));
  expect(additions.map(r => r.status).sort()).toEqual([201, 409]);
  await error(additions.find(r => r.status === 409)!, 409, 'CATEGORY_EXTENSION_EXISTS');
  expect(await env.DB.prepare('SELECT count(*) AS n FROM category_extensions WHERE category_id=?').bind(group.id).first('n')).toBe(1);
  const other = (await createSession()).cookie;
  expect((await api(other, '', 'POST', { name: 'TOOLS' })).status).toBe(201);
});

it('FINAL category: rename duplicate rolls back name/members and full replacement never changes block policies', async () => {
  const { cookie } = await createSession();
  const first = await create(cookie, 'Tools', ['exe', 'pdf']);
  await create(cookie, 'Other', ['zip']);
  expect((await api(cookie, '/' + first.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
  const policyBefore = await policies(cookie);
  await error(await api(cookie, '/' + first.id, 'PUT', { name: ' other ', extensions: ['js'] }), 409, 'CATEGORY_EXISTS');
  expect((await groups(cookie)).find((c: any) => c.id === first.id)).toMatchObject({ name: 'Tools', extensions: ['exe', 'pdf'] });
  expect((await api(cookie, '/' + first.id, 'PUT', { name: 'Changed', extensions: ['.ZIP', 'zip', 'js'] })).status).toBe(200);
  expect((await groups(cookie)).find((c: any) => c.id === first.id)).toMatchObject({ name: 'Changed', extensions: ['js', 'zip'] });
  expect(await policies(cookie)).toEqual(policyBefore);
});

it('FINAL category: all member/rename/state actions reject foreign IDs and builtin names/deletion stay protected', async () => {
  const a = (await createSession()).cookie, b = (await createSession()).cookie;
  const group = await create(a, 'Private', ['exe', 'pdf']);
  const before = await groups(a);
  for (const [path, method, body] of [['', 'PUT', { name: 'Stolen' }], ['/extensions', 'POST', { extension: 'zip' }], ['/extensions/pdf', 'DELETE', undefined], ['/state', 'PATCH', { blocked: false }], ['', 'DELETE', undefined]] as const) {
    await error(await api(b, '/' + group.id + path, method, body), 404, 'CATEGORY_NOT_FOUND');
  }
  expect(await groups(a)).toEqual(before);
  for (const method of ['PUT', 'DELETE']) await error(await api(a, '/photos', method, method === 'PUT' ? { name: 'Changed' } : undefined), 400, 'INVALID_CATEGORY_ACTION');
  expect((await policies(a)).customCount).toBe(0);
});

it('FINAL category: empty groups are no-op; exact 200 admits existing members/fixed updates and allow only affects targets', async () => {
  const { cookie } = await createSession(); const session = await sessionId(cookie);
  const empty = await create(cookie, 'Empty');
  for (const blocked of [true, false]) {
    const response = await api(cookie, '/' + empty.id + '/state', 'PATCH', { blocked });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ changed: 0 });
  }
  await env.DB.batch(Array.from({ length: 200 }, (_, i) => env.DB.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'custom',1)").bind(session, 'x' + i)));
  const target = await create(cookie, 'Existing', ['exe', 'x0']);
  expect((await api(cookie, '/' + target.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
  expect((await policies(cookie)).customCount).toBe(200);
  expect((await policies(cookie)).fixed.find((p: any) => p.extension === 'exe').blocked).toBe(true);
  expect((await api(cookie, '/' + target.id + '/state', 'PATCH', { blocked: false })).status).toBe(200);
  const after = await policies(cookie);
  expect(after.customCount).toBe(199); expect(after.custom.some((p: any) => p.extension === 'x1')).toBe(true);
  expect(after.custom.some((p: any) => p.extension === 'x0')).toBe(false);
  expect(after.fixed.find((p: any) => p.extension === 'exe').blocked).toBe(false);
  expect((await api(cookie, '/' + empty.id, 'DELETE')).status).toBe(204);
  expect((await policies(cookie)).customCount).toBe(199);
});

it('FINAL category: a single custom addition races bulk at 199 without partial fixed updates', async () => {
  const { cookie } = await createSession(); const session = await sessionId(cookie);
  const group = await create(cookie, 'Batch', ['exe', 'zip']);
  await env.DB.batch(Array.from({ length: 199 }, (_, i) => env.DB.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'custom',1)").bind(session, 'x' + i)));
  const results = await Promise.all([api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true }), exports.default.fetch('https://example.test/api/policies/custom', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ extension: 'one' }) })]);
  expect(results.filter(r => r.ok)).toHaveLength(1); expect(results.filter(r => r.status === 409)).toHaveLength(1);
  const data = await policies(cookie);
  expect(data.customCount).toBe(200);
  expect(data.fixed.find((p: any) => p.extension === 'exe').blocked).toBe(data.custom.some((p: any) => p.extension === 'zip'));
});

it('FINAL category: allow batch failure rolls back both fixed and custom changes', async () => {
  const { cookie } = await createSession(); const group = await create(cookie, 'Rollback', ['exe', 'pdf']);
  await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true });
  const before = await policies(cookie);
  await env.DB.exec("CREATE TRIGGER reject_allow BEFORE DELETE ON session_extension_policies WHEN OLD.extension='pdf' BEGIN SELECT RAISE(ABORT, 'local allow rollback'); END");
  await error(await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: false }), 503, 'STORAGE_UNAVAILABLE');
  expect(await policies(cookie)).toEqual(before);
  await env.DB.exec('DROP TRIGGER reject_allow');
  expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: false })).status).toBe(200);
  expect((await policies(cookie)).customCount).toBe(0);
});

it('FINAL category: malformed JSON/content type/extra fields/oversize/origin never alter membership or policies', async () => {
  const { cookie } = await createSession();
  const before = await groups(cookie);
  for (const [body, type, status, code] of [['{', 'application/json', 400, 'INVALID_JSON'], ['null', 'application/json', 400, 'INVALID_INPUT'], ['{}', 'text/plain', 415, 'UNSUPPORTED_MEDIA_TYPE'], [' '.repeat(4097), 'application/json', 413, 'BODY_TOO_LARGE']] as const) {
    await error(await exports.default.fetch(root, { method: 'POST', headers: { cookie, 'content-type': type }, body }), status, code);
  }
  await error(await exports.default.fetch(root, { method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: 'https://other.test' }, body: JSON.stringify({ name: 'Denied' }) }), 403, 'ORIGIN_REJECTED');
  for (const body of [{ blocked: 'true' }, { blocked: true, extra: 1 }, {}]) await error(await api(cookie, '/photos/state', 'PATCH', body), 400, 'INVALID_INPUT');
  await error(await api(cookie, '/photos/extensions', 'POST', { extension: 'zip', extra: 1 }), 400, 'INVALID_EXTENSION');
  await error(await api(cookie, '/photos/extensions/bad.ext', 'DELETE'), 400, 'INVALID_EXTENSION');
  expect(await groups(cookie)).toEqual(before); expect((await policies(cookie)).customCount).toBe(0);
});

it('FINAL category: actual create and bulk block constraint failures leave no partial group or policies', async () => {
  const { cookie } = await createSession();
  await env.DB.exec("CREATE TRIGGER reject_create_member BEFORE INSERT ON category_extensions WHEN NEW.extension='zip' BEGIN SELECT RAISE(ABORT, 'local create rollback'); END");
  await error(await api(cookie, '', 'POST', { name: 'Must rollback', extensions: ['pdf', 'zip'] }), 503, 'STORAGE_UNAVAILABLE');
  expect((await groups(cookie))).toHaveLength(4);
  expect(await env.DB.prepare("SELECT count(*) AS n FROM category_extensions WHERE extension IN ('pdf','zip')").first('n')).toBe(1);
  await env.DB.exec('DROP TRIGGER reject_create_member');
  const group = await create(cookie, 'Block rollback', ['exe', 'pdf', 'zip']);
  const before = await policies(cookie);
  await env.DB.exec("CREATE TRIGGER reject_bulk_insert BEFORE INSERT ON session_extension_policies WHEN NEW.extension='zip' BEGIN SELECT RAISE(ABORT, 'local block rollback'); END");
  await error(await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true }), 503, 'STORAGE_UNAVAILABLE');
  expect(await policies(cookie)).toEqual(before);
  await env.DB.exec('DROP TRIGGER reject_bulk_insert');
  expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
  expect((await policies(cookie)).customCount).toBe(2);
});

it('FINAL category: real schema enforces member PK, FK and normalized characters even through direct SQL', async () => {
  const { cookie } = await createSession(); const group = await create(cookie, 'Schema', ['zip']);
  for (const extension of ['zip', 'ZIP', 'a-b', '', 'a'.repeat(21)]) {
    await expect(env.DB.prepare('INSERT INTO category_extensions(category_id,extension) VALUES (?,?)').bind(group.id, extension).run()).rejects.toThrow();
  }
  await expect(env.DB.prepare('INSERT INTO category_extensions(category_id,extension) VALUES (?,?)').bind('missing-group', 'pdf').run()).rejects.toThrow();
  expect((await groups(cookie)).find((c: any) => c.id === group.id).extensions).toEqual(['zip']);
});

it('FINAL category: bulk mutation takes current membership inside the statement instead of a stale read', async () => {
  const { cookie } = await createSession(); const group = await create(cookie, 'Current', ['pdf']);
  const prepare = env.DB.prepare.bind(env.DB);
  let entered!: () => void, release!: () => void;
  const atMutation = new Promise<void>(resolve => entered = resolve);
  const held = new Promise<void>(resolve => release = resolve);
  // A narrow await boundary preserves all real D1 SQL and controls only execution order.
  vi.spyOn(env.DB, 'prepare').mockImplementation(sql => {
    const statement = prepare(sql);
    if (sql.startsWith('WITH target AS')) {
      const bind = statement.bind.bind(statement);
      vi.spyOn(statement, 'bind').mockImplementation((...args) => {
        const bound = bind(...args), run = bound.run.bind(bound);
        vi.spyOn(bound, 'run').mockImplementation(async () => { entered(); await held; return run(); });
        return bound;
      });
    }
    return statement;
  });
  const { categoriesApi } = await import('../../server/categories');
  const session = await sessionId(cookie);
  const pending = categoriesApi(new Request(root + '/' + group.id + '/state', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blocked: true }) }), env.DB, '/api/policies/categories/' + group.id + '/state', session);
  try {
    await atMutation;
    expect((await api(cookie, '/' + group.id + '/extensions/pdf', 'DELETE')).status).toBe(204);
    expect((await api(cookie, '/' + group.id + '/extensions', 'POST', { extension: 'zip' })).status).toBe(201);
  } finally { release(); }
  expect((await pending)!.status).toBe(200);
  const data = await policies(cookie);
  expect(data.custom.map((p: any) => p.extension)).toEqual(['zip']);
});

it('FINAL category: bulk policy changes before T reject, after T preserve real bytes and block the next upload', async () => {
  const { cookie } = await createSession(); const session = await sessionId(cookie);
  const group = await create(cookie, 'T boundary', ['pdf']);
  const form = new FormData(); form.set('file', new File(['T-before'], 'before.pdf'));
  const serialized = new Response(form), bytes = new Uint8Array(await serialized.arrayBuffer());
  let release!: () => void;
  const held = new Promise<void>(resolve => release = resolve);
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, 10)); void held.then(() => { controller.enqueue(bytes.slice(10)); controller.close(); }); } });
  const receiving = upload(new Request('https://example.test/api/uploads', { method: 'POST', headers: { 'content-type': serialized.headers.get('content-type')! }, body }), env, 'category-before', session);
  try { expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(200); }
  finally { release(); }
  expect((await receiving).status).toBe(422);
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
  await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: false });
  const actual = env.UPLOADS.put.bind(env.UPLOADS);
  const put = vi.spyOn(env.UPLOADS, 'put').mockImplementationOnce(async (...args: Parameters<R2Bucket['put']>) => {
    expect((await api(cookie, '/' + group.id + '/state', 'PATCH', { blocked: true })).status).toBe(200);
    return actual(...args);
  });
  const send = () => { const data = new FormData(); data.set('file', new File(['T-after'], 'after.pdf')); return upload(new Request('https://example.test/api/uploads', { method: 'POST', body: data }), env, 'category-after', session); };
  const accepted = await send(); expect(accepted.status).toBe(201);
  const { id } = await accepted.json<any>();
  expect(await (await env.UPLOADS.get('uploads/' + id))!.text()).toBe('T-after');
  expect((await send()).status).toBe(422);
  expect(put).toHaveBeenCalledTimes(1); expect((await env.UPLOADS.list()).objects).toHaveLength(1);
});
