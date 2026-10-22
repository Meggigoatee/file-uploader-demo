import { env } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import policies from '../../migrations/0001_initial.sql?raw';
import budget from '../../migrations/0002_budget.sql?raw';
import { upload } from '../../server/uploads';
import { LIMITS } from '../../shared/rules';

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, [policies,budget].map((sql,i) => ({ name: String(i), queries: sql.split(';').map(s => s.trim()).filter(Boolean) })));
});
afterEach(() => vi.restoreAllMocks());
const send = (name='문서.txt', bytes: Uint8Array | string = 'hello', type='text/plain') => {
  const form = new FormData();
  form.set('file', new File([bytes], name, {type}));
  return upload(new Request('https://example.test/api/uploads',{method:'POST',body:form}), env, 'test-request');
};
const objectCount = async () => (await env.UPLOADS.list()).objects.length;
describe('TC06-10: bounded receive, T, real D1 budget and R2 bytes', () => {
  it('stores exact bytes under a private UUID key; ignores supplied MIME', async () => {
    const response = await send('문서.txt', new Uint8Array([0,255,42]), 'image/png');
    expect(response.status).toBe(201);
    const data = await response.json<any>();
    expect(data).toMatchObject({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), size:3, requestId:'test-request' });
    const saved = await env.UPLOADS.get('uploads/' + data.id);
    expect([...new Uint8Array(await saved!.arrayBuffer())]).toEqual([0,255,42]);
    expect(saved!.httpMetadata?.contentType).toBe('application/octet-stream');
    expect(await env.DB.prepare('SELECT reserved_bytes FROM upload_budget').first('reserved_bytes')).toBe(3);
    expect(await env.DB.prepare('SELECT reserved_puts FROM upload_budget').first('reserved_puts')).toBe(1);
    await applyD1Migrations(env.DB,[{name:'budget-seed-again',queries:budget.split(';').map(s=>s.trim()).filter(Boolean)}]);
    expect(await env.DB.prepare('SELECT reserved_puts FROM upload_budget').first('reserved_puts')).toBe(1);
    expect((await send('archive.tar.gz','archive')).status).toBe(201);
  });
  it('allows unchecked exe but rejects checked and embedded dot tokens without storing', async () => {
    expect((await send('a.exe')).status).toBe(201);
    await env.DB.prepare("UPDATE extension_policies SET blocked=1 WHERE extension='exe'").run();
    for (const name of ['a.EXE', 'a.exe.txt']) {
      const response = await send(name,'x','image/png');
      expect(response.status).toBe(422);
      expect(await response.json<any>()).toMatchObject({error:{code:'BLOCKED_EXTENSION'}});
    }
    expect(await objectCount()).toBe(1);
  });
  it('rejects missing fixed policy using actual DB fixture and never writes', async () => {
    await env.DB.prepare("DELETE FROM extension_policies WHERE extension='exe'").run();
    expect((await send()).status).toBe(503);
    expect(await objectCount()).toBe(0);
  });
  it('enforces 1 byte, exact 5 MiB, and 5 MiB+1 boundaries', async () => {
    expect((await send('zero.txt','')).status).toBe(422);
    expect((await send('max.txt',new Uint8Array(LIMITS.file))).status).toBe(201);
    expect((await send('over.txt',new Uint8Array(LIMITS.file+1))).status).toBe(413);
    expect(await objectCount()).toBe(1);
  });
  it('validates actual streamed body length even with false Content-Length', async () => {
    const request = new Request('https://example.test/api/uploads',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=x','content-length':'1'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(LIMITS.body)); c.enqueue(new Uint8Array(1)); c.close();}})});
    expect((await upload(request,env,'size')).status).toBe(413);
    expect(await objectCount()).toBe(0);
    const withoutLength=new Request('https://example.test/api/uploads',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=x'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(LIMITS.body+1));c.close();}})});
    expect((await upload(withoutLength,env,'no-length')).status).toBe(413);
  });
  it('enforces UTF-8 filename bytes at the server boundary', async () => {
    expect((await send('가'.repeat(83)+'aa.txt')).status).toBe(201);
    expect((await send('가'.repeat(84)+'.txt')).status).toBe(422);
    expect(await objectCount()).toBe(1);
  });
  it('rejects malformed multipart, wrong type, extra/multiple/string file fields', async () => {
    for (const mode of ['none','extra','multiple','string']) {
      const form = new FormData();
      if (mode !== 'none') form.append('file',mode === 'string' ? 'x' : new File(['x'],'a.txt'));
      if (mode === 'extra') form.append('other','x');
      if (mode === 'multiple') form.append('file',new File(['x'],'b.txt'));
      expect((await upload(new Request('https://example.test/api/uploads',{method:'POST',body:form}),env,'form')).status).toBe(400);
    }
    expect((await upload(new Request('https://example.test/api/uploads',{method:'POST',body:'x'}),env,'type')).status).toBe(415);
    expect((await upload(new Request('https://example.test/api/uploads',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=x'},body:'invalid'}),env,'parse')).status).toBe(400);
    expect(await objectCount()).toBe(0);
  });
  it('rejects dangerous raw multipart filenames without URL decoding', async () => {
    for (const name of ['../a.txt','a/b.txt','c:a.txt','.env','a..txt','a.txt ']) {
      const body = `--raw\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\nx\r\n--raw--\r\n`;
      expect((await upload(new Request('https://example.test/api/uploads',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=raw'},body}),env,'raw')).status, name).toBe(422);
    }
    expect(await objectCount()).toBe(0);
  });
  it('reserves app budget atomically on same DB and does not put on rejection', async () => {
    await env.DB.prepare('UPDATE upload_budget SET reserved_bytes=?,reserved_puts=499').bind(LIMITS.bytes - 1).run();
    const results = await Promise.all([send('one.txt','x'),send('two.txt','y')]);
    expect(results.map(r=>r.status).sort()).toEqual([201,503]);
    expect(await objectCount()).toBe(1);
    const rejected = results.find(r=>r.status===503)!;
    expect(await rejected.json<any>()).toMatchObject({error:{code:'UPLOAD_QUOTA_EXCEEDED'}});
    expect(await env.DB.prepare('SELECT reserved_bytes FROM upload_budget').first('reserved_bytes')).toBe(LIMITS.bytes);
    expect(await env.DB.prepare('SELECT reserved_puts FROM upload_budget').first('reserved_puts')).toBe(500);
  });
  it.each(['bytes','puts'])('checks the %s budget independently on the same DB', async kind => {
    await env.DB.prepare('UPDATE upload_budget SET reserved_bytes=?,reserved_puts=?').bind(kind==='bytes' ? LIMITS.bytes-1 : 0, kind==='puts' ? LIMITS.puts-1 : 0).run();
    const results=await Promise.all([send('a.txt','x'),send('b.txt','y')]);
    expect(results.map(r=>r.status).sort()).toEqual([201,503]);
    expect(await objectCount()).toBe(1);
  });
  it('includes a policy change while actual request body is still being received, before T', async () => {
    const form=new FormData(); form.set('file',new File(['x'],'before.exe'));
    const serialized=new Response(form);
    const bytes=new Uint8Array(await serialized.arrayBuffer());
    let release!:()=>void;
    const held=new Promise<void>(resolve=>release=resolve);
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes.slice(0,10)); void held.then(()=>{controller.enqueue(bytes.slice(10));controller.close();});}});
    const receiving=upload(new Request('https://example.test/api/uploads',{method:'POST',headers:{'content-type':serialized.headers.get('content-type')!},body}),env,'before');
    await env.DB.prepare("UPDATE extension_policies SET blocked=1 WHERE extension='exe'").run();
    release();
    expect((await receiving).status).toBe(422);
    expect(await objectCount()).toBe(0);
  });
  it('T snapshot stays accepted when policy changes after check, while next request is blocked', async () => {
    const original = env.UPLOADS.put.bind(env.UPLOADS);
    const spy = vi.spyOn(env.UPLOADS,'put').mockImplementationOnce(async (...args: Parameters<R2Bucket['put']>) => {
      await env.DB.prepare("UPDATE extension_policies SET blocked=1 WHERE extension='exe'").run();
      return original(...args);
    });
    expect((await send('first.exe')).status).toBe(201);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await send('next.exe')).status).toBe(422);
    expect(await objectCount()).toBe(1);
  });
});
