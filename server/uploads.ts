import { blockedToken, filenameTokens, LIMITS } from '../shared/rules';
import { failure, HttpError, json, readBounded } from './http';
import { readPolicies } from './policies';

export async function upload(request: Request, env: Env, requestId: string): Promise<Response> {
  try {
    if (!/^multipart\/form-data\s*;/i.test(request.headers.get('content-type') ?? '')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'multipart 파일 전송이 필요합니다.');
    const bytes = await readBounded(request, LIMITS.body);
    let form: FormData;
    try { form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type')! } }).formData(); }
    catch { throw new HttpError(400, 'INVALID_MULTIPART', '파일 전송 형식을 확인해 주세요.'); }
    const entries = [...form.entries()];
    if (entries.length !== 1 || entries[0][0] !== 'file' || !(entries[0][1] instanceof File)) throw new HttpError(400, 'INVALID_FILE_COUNT', 'file 필드에 파일 하나만 전송해 주세요.');
    const file = entries[0][1];
    if (file.size === 0) throw new HttpError(422, 'EMPTY_FILE', '빈 파일은 업로드할 수 없습니다.');
    if (file.size > LIMITS.file) throw new HttpError(413, 'FILE_TOO_LARGE', '파일은 5 MiB 이하여야 합니다.');
    if (!filenameTokens(file.name)) throw new HttpError(422, 'INVALID_FILENAME', '파일명과 확장자를 확인해 주세요.');

    // T: a single DB snapshot after receiving/validating the file, before reservation/storage.
    const policies = await readPolicies(env.DB);
    const blocked = new Set([...policies.fixed, ...policies.custom].filter(p => p.blocked).map(p => p.extension));
    const token = blockedToken(file.name, blocked);
    if (token) throw new HttpError(422, 'BLOCKED_EXTENSION', `차단된 확장자(${token})가 포함된 파일입니다.`);
    const reserved = await env.DB.prepare('UPDATE upload_budget SET reserved_bytes=reserved_bytes+?,reserved_puts=reserved_puts+1,updated_at=? WHERE id=1 AND reserved_bytes+?<=? AND reserved_puts+1<=?').bind(file.size, new Date().toISOString(), file.size, LIMITS.bytes, LIMITS.puts).run();
    if (reserved.meta.changes !== 1) throw new HttpError(503, 'UPLOAD_QUOTA_EXCEEDED', '데모의 누적 저장 예산이 소진되었습니다.');
    const id = crypto.randomUUID();
    const stored = await env.UPLOADS.put('uploads/' + id, file.stream(), { httpMetadata: { contentType: 'application/octet-stream' } });
    if (!stored || stored.size !== file.size) throw new HttpError(503, 'STORAGE_UNAVAILABLE', '저장 완료를 확인할 수 없습니다.');
    return json({ id, size: file.size, requestId }, 201);
  } catch (error) {
    if (error instanceof HttpError) return failure(error.code, error.message, error.status, requestId);
    console.error(JSON.stringify({ time: new Date().toISOString(), requestId, operation: 'upload', status: 503, code: 'STORAGE_UNAVAILABLE' }));
    return failure('STORAGE_UNAVAILABLE', '저장 완료를 확인할 수 없습니다. 수동으로 다시 시도해 주세요.', 503, requestId);
  }
}
