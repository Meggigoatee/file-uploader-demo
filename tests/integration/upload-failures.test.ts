import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { upload } from '../../server/uploads';
import { migrate, createSession, sessionId } from './fixtures';

let session: string;
beforeEach(async () => { await migrate(); session = await sessionId((await createSession()).cookie); });
afterEach(() => vi.restoreAllMocks());
const text = 'failure-bytes';
function send() {
  const form = new FormData(); form.set('file', new File([text], 'failure.txt'));
  return upload(new Request('https://example.test/api/uploads', { method: 'POST', body: form }), env, 'failure-test', session);
}
const budget = () => env.DB.prepare('SELECT reserved_bytes,reserved_puts FROM upload_budget WHERE id=1').first();
async function unavailable(response: Response) {
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: 'STORAGE_UNAVAILABLE' }, requestId: 'failure-test' });
}

it('FINAL upload: actual D1 reservation failure prevents put and does not consume budget', async () => {
  await env.DB.exec("CREATE TRIGGER reject_reservation BEFORE UPDATE ON upload_budget BEGIN SELECT RAISE(ABORT, 'local reservation failure'); END");
  const put = vi.spyOn(env.UPLOADS, 'put');
  await unavailable(await send());
  expect(put).not.toHaveBeenCalled();
  expect(await budget()).toEqual({ reserved_bytes: 0, reserved_puts: 0 });
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
});
it('FINAL upload: unconfirmed reservation result prevents put even when the real reservation committed', async () => {
  const prepare = env.DB.prepare.bind(env.DB);
  vi.spyOn(env.DB, 'prepare').mockImplementation(sql => {
    const statement = prepare(sql);
    if (sql.startsWith('UPDATE upload_budget')) {
      const bind = statement.bind.bind(statement);
      vi.spyOn(statement, 'bind').mockImplementation((...args) => {
        const bound = bind(...args), run = bound.run.bind(bound);
        vi.spyOn(bound, 'run').mockImplementation(async () => { await run(); throw new Error('local result delivery failure'); });
        return bound;
      });
    }
    return statement;
  });
  const put = vi.spyOn(env.UPLOADS, 'put');
  await unavailable(await send());
  expect(put).not.toHaveBeenCalled();
  expect(await budget()).toEqual({ reserved_bytes: text.length, reserved_puts: 1 });
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
});
it('FINAL upload: put rejection preserves reservation; a manual new attempt reserves again and saves exact bytes', async () => {
  const put = vi.spyOn(env.UPLOADS, 'put').mockRejectedValueOnce(new Error('local put rejection'));
  await unavailable(await send());
  expect(put).toHaveBeenCalledTimes(1);
  expect((await env.UPLOADS.list()).objects).toHaveLength(0);
  expect(await budget()).toEqual({ reserved_bytes: text.length, reserved_puts: 1 });
  const retry = await send(); expect(retry.status).toBe(201);
  const { id } = await retry.json<any>();
  expect(await (await env.UPLOADS.get('uploads/' + id))!.text()).toBe(text);
  expect(put).toHaveBeenCalledTimes(2);
  expect(await budget()).toEqual({ reserved_bytes: text.length * 2, reserved_puts: 2 });
});
it.each(['null', 'wrong-size', 'throw-after-save'])('FINAL upload: %s put confirmation never returns success or refunds real saved bytes', async mode => {
  const actual = env.UPLOADS.put.bind(env.UPLOADS);
  const put = vi.spyOn(env.UPLOADS, 'put').mockImplementationOnce(async (...args: Parameters<R2Bucket['put']>) => {
    const saved = await actual(...args);
    if (mode === 'throw-after-save') throw new Error('local saved result delivery failure');
    return mode === 'null' ? null : { ...saved!, size: text.length + 1 } as R2Object;
  });
  await unavailable(await send());
  expect(put).toHaveBeenCalledTimes(1);
  const objects = (await env.UPLOADS.list()).objects;
  expect(objects).toHaveLength(1);
  expect(await (await env.UPLOADS.get(objects[0].key))!.text()).toBe(text);
  expect(await budget()).toEqual({ reserved_bytes: text.length, reserved_puts: 1 });
});
