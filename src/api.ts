import { FIXED } from '../shared/rules';
import type { Policies } from '../shared/types';

export class ApiError extends Error {
  constructor(message: string, public uncertain = false, public code = '') { super(message); }
}

export async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  let response: Response;
  try { response = await fetch(path, { method, cache: 'no-store', headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new ApiError('서버 응답을 확인하지 못했습니다. 다시 불러와 주세요.', true); }
  if (response.status === 204) return;
  let data: any;
  try { data = await response.json(); } catch { throw new ApiError('서버 응답을 확인하지 못했습니다. 다시 불러와 주세요.', true); }
  if (!response.ok) throw new ApiError(data?.error?.message ?? '요청을 처리하지 못했습니다.', response.status >= 500 || !data?.error?.code, data?.error?.code);
  return data;
}

export function isPolicies(data: any): data is Policies {
  return !!data && Array.isArray(data.fixed) && Array.isArray(data.custom) &&
    data.fixed.length === FIXED.length && FIXED.every(extension => data.fixed.some((p: any) => p.extension === extension && p.kind === 'fixed' && typeof p.blocked === 'boolean')) &&
    data.custom.length <= 200 && data.custom.every((p: any) => /^[a-z0-9]{1,20}$/.test(p.extension) && p.kind === 'custom' && p.blocked === true) && data.customCount === data.custom.length;
}
