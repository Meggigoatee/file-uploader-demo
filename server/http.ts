export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export function failure(code: string, message: string, status: number, requestId: string): Response {
  return json({ error: { code, message }, requestId }, status);
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function readBounded(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'BODY_TOO_LARGE', '요청 본문이 너무 큽니다.');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new HttpError(413, 'BODY_TOO_LARGE', '요청 본문이 너무 큽니다.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 형식이 필요합니다.');
  const bytes = await readBounded(request, 4096);
  let data: unknown;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'INVALID_JSON', 'JSON 본문을 확인해 주세요.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'INVALID_INPUT', '입력 형식이 올바르지 않습니다.');
  return data as Record<string, unknown>;
}
