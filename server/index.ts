import { failure, HttpError } from './http';
import { policiesApi } from './policies';
import { upload } from './uploads';
import { initializeSession, requireSession } from './session';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const requestId = crypto.randomUUID();
    const started = Date.now();
    let response: Response;
    try {
      const origin = request.headers.get('origin');
      if (!['GET', 'HEAD'].includes(request.method) && origin && origin !== url.origin) throw new HttpError(403, 'ORIGIN_REJECTED', '다른 출처의 변경 요청은 허용하지 않습니다.');
      if (url.pathname === '/api/session' && request.method === 'POST') response = await initializeSession(request, env.DB);
      else if (url.pathname === '/api/policies' || url.pathname.startsWith('/api/policies/') || (url.pathname === '/api/uploads' && request.method === 'POST')) {
        const sessionId = await requireSession(request, env.DB);
        response = url.pathname === '/api/uploads'
          ? await upload(request, env, requestId, sessionId)
          : await policiesApi(request, env.DB, url.pathname, sessionId) ?? failure('NOT_FOUND', '요청한 API가 없습니다.', 404, requestId);
      } else response = failure('NOT_FOUND', '요청한 API가 없습니다.', 404, requestId);
    } catch (error) {
      response = error instanceof HttpError ? failure(error.code, error.message, error.status, requestId)
        : failure('STORAGE_UNAVAILABLE', '저장소를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', 503, requestId);
    }
    const result = response.status === 204 ? null : await response.clone().json() as { extension?: string; blocked?: boolean; size?: number; error?: { code: string } };
    const operation = url.pathname.startsWith('/api/policies/fixed/') ? 'policy.fixed' : url.pathname.startsWith('/api/policies/custom') ? 'policy.custom' : url.pathname === '/api/policies' ? 'policy.read' : url.pathname === '/api/uploads' ? 'upload' : url.pathname === '/api/session' ? 'session.initialize' : 'api.unknown';
    console.info(JSON.stringify({ time:new Date().toISOString(), requestId, operation, method:request.method, status:response.status, durationMs:Date.now()-started,
      extension:result?.extension ?? (response.status===204 ? url.pathname.split('/').at(-1) : undefined), blocked:result?.blocked, size:result?.size, code:result?.error?.code }));
    return response;
  },
} satisfies ExportedHandler<Env>;
