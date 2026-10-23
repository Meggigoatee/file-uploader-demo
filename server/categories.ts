import { BUILTIN_CATEGORIES, CATEGORY_LIMITS, categoryInput, type Category } from '../shared/categories';
import { FIXED, LIMITS, normalizeExtension } from '../shared/rules';
import { HttpError, json, readJson } from './http';

const root = '/api/policies/categories';
const fixedSql = FIXED.map(e => "'" + e + "'").join(',');

export function categorySeeds(db: D1Database, sessionId: string): D1PreparedStatement[] {
  return BUILTIN_CATEGORIES.flatMap(category => {
    const id = sessionId + ':' + category.id;
    return [db.prepare('INSERT INTO custom_categories(id,session_id,name,builtin_key) VALUES (?,?,?,?)').bind(id, sessionId, category.name, category.id),
      ...category.extensions.map(extension => db.prepare('INSERT INTO category_extensions(category_id,extension) VALUES (?,?)').bind(id, extension))];
  });
}

async function readCategories(db: D1Database, sessionId: string): Promise<Category[]> {
  const { results: groups } = await db.prepare("SELECT id,name,builtin_key FROM custom_categories WHERE session_id=? ORDER BY CASE builtin_key WHEN 'photos' THEN 0 WHEN 'videos' THEN 1 WHEN 'audio' THEN 2 WHEN 'documents' THEN 3 ELSE 4 END,name,id").bind(sessionId).all<{ id: string; name: string; builtin_key: string | null }>();
  const { results: members } = await db.prepare('SELECT category_id,extension FROM category_extensions WHERE category_id IN (SELECT id FROM custom_categories WHERE session_id=?) ORDER BY extension').bind(sessionId).all<{ category_id: string; extension: string }>();
  return groups.map(c => ({ id: c.builtin_key ?? c.id, name: c.name, builtin: !!c.builtin_key, extensions: members.filter(m => m.category_id === c.id).map(m => m.extension) }));
}

export async function categoriesApi(request: Request, db: D1Database, path: string, sessionId: string): Promise<Response | undefined> {
  if (path !== root && !path.startsWith(root + '/')) return;
  if (path === root && request.method === 'GET') return json({ categories: await readCategories(db, sessionId) });
  const parts = path.slice(root.length + 1).split('/');
  const id = parts[0];
  const isCreate = path === root && request.method === 'POST';
  const category = isCreate ? null : await db.prepare('SELECT id,builtin_key FROM custom_categories WHERE session_id=? AND (id=? OR builtin_key=?)').bind(sessionId, id, id).first<{ id: string; builtin_key: string | null }>();
  if (!isCreate && !category) throw new HttpError(404, 'CATEGORY_NOT_FOUND', '카테고리를 찾을 수 없습니다. 다시 불러와 주세요.');
  const builtin = !!category?.builtin_key;
  if (isCreate || (parts.length === 1 && request.method === 'PUT' && !builtin)) {
    const body = await readJson(request);
    const previous = isCreate ? [] : (await db.prepare('SELECT extension FROM category_extensions WHERE category_id=? ORDER BY extension').bind(category!.id).all<{ extension: string }>()).results.map(row => row.extension);
    const input = categoryInput(body.name, body.extensions === undefined ? previous : body.extensions);
    if (!input || !Object.keys(body).every(key => ['name','extensions'].includes(key))) throw new HttpError(400, 'INVALID_CATEGORY', '이름은 1~30자, 확장자는 영문·숫자 20자 이내로 최대 50개 입력해 주세요. 기본 카테고리 이름은 사용할 수 없습니다.');
    const categoryId = isCreate ? crypto.randomUUID() : category!.id;
    const statements = [isCreate
      ? db.prepare('INSERT INTO custom_categories(id,session_id,name) VALUES (?,?,?)').bind(categoryId, sessionId, input.name)
      : db.prepare('UPDATE custom_categories SET name=? WHERE id=? AND session_id=?').bind(input.name, categoryId, sessionId)];
    if (isCreate || body.extensions !== undefined) {
      if (!isCreate) statements.push(db.prepare('DELETE FROM category_extensions WHERE category_id=? AND category_id IN (SELECT id FROM custom_categories WHERE session_id=?)').bind(categoryId, sessionId));
      statements.push(...input.extensions.map(extension => db.prepare('INSERT INTO category_extensions(category_id,extension) SELECT id,? FROM custom_categories WHERE id=? AND session_id=?').bind(extension, categoryId, sessionId)));
    }
    try { await db.batch(statements); }
    catch (error) {
      if (String(error).includes('UNIQUE constraint failed: custom_categories.session_id, custom_categories.name')) throw new HttpError(409, 'CATEGORY_EXISTS', '같은 이름의 카테고리가 있습니다.');
      throw error;
    }
    return json({ id: categoryId, ...input, builtin: false }, isCreate ? 201 : 200);
  }
  if (parts[1] === 'extensions' && parts.length === 2 && request.method === 'POST') {
    const body = await readJson(request);
    const extension = normalizeExtension(body.extension);
    if (!extension || Object.keys(body).length !== 1) throw new HttpError(400, 'INVALID_EXTENSION', '확장자는 원문 20자 이내의 영문·숫자로 입력해 주세요.');
    const result = await db.prepare('INSERT INTO category_extensions(category_id,extension) SELECT id,? FROM custom_categories WHERE id=? AND session_id=? AND (SELECT count(*) FROM category_extensions WHERE category_id=?) < ? ON CONFLICT(category_id,extension) DO NOTHING').bind(extension, category!.id, sessionId, category!.id, CATEGORY_LIMITS.extensions).run();
    if (!result.meta.changes) {
      const exists = await db.prepare('SELECT extension FROM category_extensions WHERE category_id=? AND extension=?').bind(category!.id, extension).first();
      throw new HttpError(409, exists ? 'CATEGORY_EXTENSION_EXISTS' : 'CATEGORY_MEMBER_LIMIT', exists ? '이미 이 카테고리에 등록된 확장자입니다.' : '카테고리에는 확장자를 최대 50개 등록할 수 있습니다.');
    }
    return json({ changed: result.meta.changes }, 201);
  }
  if (parts[1] === 'extensions' && parts.length === 3 && request.method === 'DELETE') {
    if (!/^[a-z0-9]{1,20}$/.test(parts[2])) throw new HttpError(400, 'INVALID_EXTENSION', '제외할 확장자를 확인해 주세요.');
    await db.prepare('DELETE FROM category_extensions WHERE category_id=? AND extension=?').bind(category!.id, parts[2]).run();
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
  const deleting = parts.length === 1 && request.method === 'DELETE' && !builtin;
  const changingState = parts.length === 2 && parts[1] === 'state' && request.method === 'PATCH';
  if (!deleting && !changingState) throw new HttpError(400, 'INVALID_CATEGORY_ACTION', '지원하지 않는 카테고리 작업입니다.');
  let blocked = false;
  if (changingState) {
    const body = await readJson(request);
    if (typeof body.blocked !== 'boolean' || Object.keys(body).length !== 1) throw new HttpError(400, 'INVALID_INPUT', 'blocked는 boolean이어야 합니다.');
    blocked = body.blocked;
  }
  // Target membership is read by the mutation itself, so concurrent edits cannot leave a stale copied list.
  const target = 'SELECT extension FROM category_extensions WHERE category_id=? AND category_id IN (SELECT id FROM custom_categories WHERE session_id=?)';
  const bindings = [category!.id, sessionId];
  if (blocked) {
    const result = await db.prepare(`WITH target AS (${target})
      INSERT INTO session_extension_policies(session_id,extension,kind,blocked)
      SELECT ?,extension,CASE WHEN extension IN (${fixedSql}) THEN 'fixed' ELSE 'custom' END,1 FROM target
      WHERE (SELECT count(*) FROM session_extension_policies WHERE session_id=? AND kind='custom') +
        (SELECT count(*) FROM target WHERE extension NOT IN (${fixedSql}) AND extension NOT IN (SELECT extension FROM session_extension_policies WHERE session_id=?)) <= ?
      ON CONFLICT(session_id,extension) DO UPDATE SET blocked=1,updated_at=?`).bind(...bindings, sessionId, sessionId, sessionId, LIMITS.custom, new Date().toISOString()).run();
    if (!result.meta.changes) {
      const count = await db.prepare(`SELECT count(*) AS n FROM (${target})`).bind(...bindings).first<number>('n');
      if (count) throw new HttpError(409, 'CUSTOM_LIMIT_REACHED', '커스텀 확장자 200개 제한으로 전체 변경을 취소했습니다.');
    }
    return json({ changed: result.meta.changes });
  }
  const statements = [
    db.prepare(`UPDATE session_extension_policies SET blocked=0,updated_at=? WHERE session_id=? AND kind='fixed' AND extension IN (${target})`).bind(new Date().toISOString(), sessionId, ...bindings),
    db.prepare(`DELETE FROM session_extension_policies WHERE session_id=? AND kind='custom' AND extension IN (${target})`).bind(sessionId, ...bindings),
  ];
  if (deleting) statements.push(db.prepare('DELETE FROM custom_categories WHERE id=? AND session_id=?').bind(category!.id, sessionId));
  const results = await db.batch(statements);
  return deleting ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }) : json({ changed: results.reduce((n, r) => n + r.meta.changes, 0) });
}
