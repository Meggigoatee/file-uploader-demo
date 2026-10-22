import { FIXED, LIMITS, normalizeExtension } from '../shared/rules';
import type { Policies, Policy } from '../shared/types';
import { HttpError, json, readJson } from './http';

export async function readPolicies(db: D1Database): Promise<Policies> {
  const { results } = await db.prepare('SELECT extension,kind,blocked FROM extension_policies ORDER BY extension').all<{ extension: string; kind: Policy['kind']; blocked: number }>();
  const fixed = results.filter(p => p.kind === 'fixed');
  const custom = results.filter(p => p.kind === 'custom');
  if (fixed.length !== FIXED.length || FIXED.some(extension => !fixed.some(p => p.extension === extension)) || custom.length > LIMITS.custom) throw new HttpError(503, 'POLICY_UNAVAILABLE', '정책을 확인할 수 없습니다. 잠시 후 다시 조회해 주세요.');
  const map = (p: typeof results[number]): Policy => ({ ...p, blocked: p.blocked === 1 });
  return { fixed: fixed.map(map), custom: custom.map(map), customCount: custom.length, limits: LIMITS };
}

export async function policiesApi(request: Request, db: D1Database, path: string): Promise<Response | undefined> {
  if (path === '/api/policies' && request.method === 'GET') return json(await readPolicies(db));
  if (path.startsWith('/api/policies/fixed/') && request.method === 'PATCH') {
    const extension = path.slice('/api/policies/fixed/'.length);
    if (!FIXED.some(e => e === extension)) throw new HttpError(404, 'INVALID_EXTENSION', '고정 확장자가 아닙니다.');
    const body = await readJson(request);
    if (typeof body.blocked !== 'boolean' || Object.keys(body).length !== 1) throw new HttpError(400, 'INVALID_INPUT', 'blocked는 boolean이어야 합니다.');
    const result = await db.prepare("UPDATE extension_policies SET blocked=?,updated_at=? WHERE extension=? AND kind='fixed'").bind(Number(body.blocked), new Date().toISOString(), extension).run();
    if (result.meta.changes !== 1) throw new HttpError(503, 'POLICY_UNAVAILABLE', '정책을 확인할 수 없습니다.');
    return json({ extension, kind: 'fixed', blocked: body.blocked });
  }
  if (path === '/api/policies/custom' && request.method === 'POST') {
    const body = await readJson(request);
    const extension = normalizeExtension(body.extension);
    if (!extension || Object.keys(body).length !== 1) throw new HttpError(400, 'INVALID_EXTENSION', '확장자는 원문 20자 이내의 영문·숫자로 입력해 주세요.');
    if (FIXED.some(e => e === extension)) throw new HttpError(409, 'FIXED_EXTENSION', '고정 확장자는 위 체크박스에서 관리해 주세요.');
    const result = await db.prepare("INSERT INTO extension_policies(extension,kind,blocked) SELECT ?,'custom',1 WHERE (SELECT count(*) FROM extension_policies WHERE kind='custom') < ? ON CONFLICT(extension) DO NOTHING").bind(extension, LIMITS.custom).run();
    if (result.meta.changes !== 1) {
      const exists = await db.prepare('SELECT extension FROM extension_policies WHERE extension=?').bind(extension).first();
      throw new HttpError(409, exists ? 'DUPLICATE_EXTENSION' : 'CUSTOM_LIMIT_REACHED', exists ? '이미 등록된 확장자입니다.' : '커스텀 확장자는 최대 200개입니다.');
    }
    return json({ extension, kind: 'custom', blocked: true }, 201);
  }
  if (path.startsWith('/api/policies/custom/') && request.method === 'DELETE') {
    const extension = path.slice('/api/policies/custom/'.length);
    if (!/^[a-z0-9]{1,20}$/.test(extension) || FIXED.some(e => e === extension)) throw new HttpError(400, 'INVALID_EXTENSION', '삭제할 커스텀 확장자를 확인해 주세요.');
    await db.prepare("DELETE FROM extension_policies WHERE extension=? AND kind='custom'").bind(extension).run();
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
}
