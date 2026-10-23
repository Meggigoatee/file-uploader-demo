import { env, exports } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sql from '../../migrations/0001_initial.sql?raw';
import { FIXED } from '../../shared/rules';
import { migrate, createSession, sessionId } from './fixtures';
let cookie: string;
let session: string;

beforeEach(async () => {
  await migrate();
  cookie = (await createSession()).cookie;
  session = await sessionId(cookie);
});
const api = (path = '', method = 'GET', body?: unknown, headers: Record<string,string> = {}) => exports.default.fetch('https://example.test/api/policies' + path, {
  method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
afterEach(()=>vi.restoreAllMocks());
describe('TC03-05: real D1 policy API', () => {
  it('records policy mutation outcome without filename, body or credentials', async () => {
    const log=vi.spyOn(console,'info').mockImplementation(()=>{});
    expect((await api('/fixed/exe','PATCH',{blocked:true})).status).toBe(200);
    expect(log).toHaveBeenCalled();
    const entry=JSON.parse(log.mock.calls[0][0] as string);
    expect(entry).toMatchObject({operation:'policy.fixed',extension:'exe',blocked:true,status:200,requestId:expect.any(String),durationMs:expect.any(Number)});
    expect(entry).not.toHaveProperty('body');
  });
  it('seeds seven unchecked fixed rows; refresh and repeated seed preserve changes', async () => {
    const response = await api();
    expect(response.status).toBe(200);
    const data = await response.json<any>();
    expect(data.fixed.map((p: any) => p.extension).sort()).toEqual([...FIXED].sort());
    expect(data.fixed.every((p: any) => p.blocked === false)).toBe(true);
    expect(data.customCount).toBe(0);
    expect((await api('/fixed/exe', 'PATCH', { blocked: true })).status).toBe(200);
    await applyD1Migrations(env.DB, [{ name: 'seed-again', queries: sql.split(';').map(s => s.trim()).filter(Boolean) }]);
    expect(await env.DB.prepare("SELECT blocked FROM session_extension_policies WHERE extension='exe'").first('blocked')).toBe(1);
    expect((await (await api()).json<any>()).fixed.find((p: any) => p.extension === 'exe').blocked).toBe(true);
  });
  it('normalizes additions; rejects duplicate/fixed; deletion is idempotent', async () => {
    expect((await api('/custom', 'POST', { extension: '. SH ' })).status).toBe(201);
    expect((await api('/custom', 'POST', { extension: 'SH' })).status).toBe(409);
    expect((await api('/custom', 'POST', { extension: 'exe' })).status).toBe(409);
    expect((await api('/custom', 'POST', { extension: 'bad.ext' })).status).toBe(400);
    expect((await api('/custom/sh', 'DELETE')).status).toBe(204);
    expect((await api('/custom/sh', 'DELETE')).status).toBe(204);
    expect((await api('/custom/exe', 'DELETE')).status).toBe(400);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM session_extension_policies WHERE kind='custom'").first('n')).toBe(0);
  });
  it('enforces schema constraints even through direct SQL', async () => {
    for (const [extension, kind, blocked] of [['EXE','fixed',0], ['foo','fixed',0], ['exe','custom',1], ['x','custom',0], ['a-b','custom',1], ['a'.repeat(21),'custom',1]]) {
      await expect(env.DB.prepare('INSERT INTO session_extension_policies (session_id,extension,kind,blocked) VALUES (?,?,?,?)').bind(session,extension,kind,blocked).run()).rejects.toThrow();
    }
  });
  it('limits customs to 200 atomically on the same DB', async () => {
    await env.DB.batch(Array.from({length:199}, (_, i) => env.DB.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'custom',1)").bind(session,'x'+i)));
    const results = await Promise.all([api('/custom','POST',{extension:'one'}), api('/custom','POST',{extension:'two'})]);
    expect(results.map(r => r.status).sort()).toEqual([201,409]);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM session_extension_policies WHERE kind='custom'").first('n')).toBe(200);
    const same = await Promise.all([api('/custom','POST',{extension:'one'}), api('/custom','POST',{extension:'one'})]);
    expect(same.every(r => r.status === 409)).toBe(true);
    expect((await api('/custom/x0','DELETE')).status).toBe(204);
    expect((await api('/custom','POST',{extension:'replacement'})).status).toBe(201);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM session_extension_policies WHERE kind='custom'").first('n')).toBe(200);
  });
  it('same-value concurrent additions create one row; disjoint fixed updates both persist', async () => {
    const same=await Promise.all([api('/custom','POST',{extension:'zip'}),api('/custom','POST',{extension:'zip'})]);
    expect(same.map(r=>r.status).sort()).toEqual([201,409]);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM session_extension_policies WHERE extension='zip'").first('n')).toBe(1);
    await Promise.all([api('/fixed/exe','PATCH',{blocked:true}),api('/fixed/cmd','PATCH',{blocked:true})]);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM session_extension_policies WHERE extension IN ('exe','cmd') AND blocked=1").first('n')).toBe(2);
    await Promise.all([api('/fixed/exe','PATCH',{blocked:true}),api('/fixed/exe','PATCH',{blocked:true})]);
    expect(await env.DB.prepare("SELECT blocked FROM session_extension_policies WHERE extension='exe'").first('blocked')).toBe(1);
  });
  it('same fixed field uses last actual commit when different desired values overlap', async () => {
    let release!:()=>void;
    const committedFalse=new Promise<void>(resolve=>release=resolve);
    const prepare=env.DB.prepare.bind(env.DB);
    vi.spyOn(env.DB,'prepare').mockImplementation(sql=>{
      const statement=prepare(sql);
      if (sql.startsWith('UPDATE session_extension_policies SET blocked=')) {
        const bind=statement.bind.bind(statement);
        vi.spyOn(statement,'bind').mockImplementation((...args)=>{
          const bound=bind(...args);
          const run=bound.run.bind(bound);
          vi.spyOn(bound,'run').mockImplementation(async()=>{
            if(args[0]===1) await committedFalse;
            const result=await run();
            if(args[0]===0) release();
            return result;
          });
          return bound;
        });
      }
      return statement;
    });
    const responses=await Promise.all([api('/fixed/exe','PATCH',{blocked:true}),api('/fixed/exe','PATCH',{blocked:false})]);
    expect(responses.map(r=>r.status)).toEqual([200,200]);
    expect(await prepare("SELECT blocked FROM session_extension_policies WHERE extension='exe'").first('blocked')).toBe(1);
  });
  it('validates origin, content type, JSON shape and actual body size', async () => {
    expect((await api('/fixed/exe','PATCH',{blocked:true},{origin:'https://elsewhere.test'})).status).toBe(403);
    expect((await api('/fixed/exe','PATCH',{blocked:true},{'content-type':'text/plain'})).status).toBe(415);
    for (const body of [null, [], {}, {blocked:'true'}, {blocked:true, extra:1}]) expect((await api('/fixed/exe','PATCH',body)).status).toBe(400);
    const raw = (body: string) => exports.default.fetch('https://example.test/api/policies/custom', {method:'POST',headers:{cookie,'content-type':'application/json'},body});
    expect((await raw('{')).status).toBe(400);
    expect((await raw(' '.repeat(4097))).status).toBe(413);
    expect((await api('/fixed/unknown','PATCH',{blocked:true})).status).toBe(404);
  });
});
