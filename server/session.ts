import { FIXED } from '../shared/rules';
import { HttpError, json } from './http';
import { categorySeeds } from './categories';

const cookieName = 'uploader_session';
async function digest(token: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function findSession(request: Request, db: D1Database): Promise<string | undefined> {
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(c => c.trim()).filter(c => c.startsWith(cookieName + '='));
  if (cookies.length !== 1) return;
  const token = cookies[0].slice(cookieName.length + 1);
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const id = await digest(token);
  return await db.prepare('SELECT id FROM anonymous_sessions WHERE id=?').bind(id).first('id') ? id : undefined;
}
export async function requireSession(request: Request, db: D1Database): Promise<string> {
  const id = await findSession(request, db);
  if (!id) throw new HttpError(401, 'SESSION_REQUIRED', '세션을 확인할 수 없습니다. 쿠키를 허용하고 정책 새로고침을 눌러 주세요.');
  return id;
}
export async function initializeSession(request: Request, db: D1Database): Promise<Response> {
  if (await findSession(request, db)) return json({ ready: true });
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
  const id = await digest(token);
  await db.batch([
    db.prepare('INSERT INTO anonymous_sessions(id) VALUES (?)').bind(id),
    ...FIXED.map(extension => db.prepare("INSERT INTO session_extension_policies(session_id,extension,kind,blocked) VALUES (?,?,'fixed',0)").bind(id, extension)),
    ...categorySeeds(db, id),
  ]);
  const response = json({ ready: true });
  response.headers.set('set-cookie', `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/api${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
  return response;
}
