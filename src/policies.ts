import { ref } from 'vue';
import type { Policies, Policy } from '../shared/types';
import { api, ApiError, isPolicies } from './api';

export function usePolicies() {
  const data = ref<Policies>();
  const ready = ref(false);
  const busy = ref(false);
  const message = ref('정책을 불러오는 중입니다.');

  async function refresh(): Promise<boolean> {
    busy.value = true;
    try {
      await api('/api/session', 'POST');
      const result = await api('/api/policies');
      if (!isPolicies(result)) throw new ApiError('정책 응답을 확인하지 못했습니다.', true);
      data.value = result;
      ready.value = true;
      message.value = '현재 정책을 불러왔습니다.';
      return true;
    } catch (error) {
      ready.value = false;
      message.value = '정책을 불러오지 못했습니다. ' + (error as Error).message;
      return false;
    } finally { busy.value = false; }
  }

  async function save(path: string, method: string, body?: unknown): Promise<Policy | true | false> {
    if (!ready.value || busy.value) return false;
    busy.value = true;
    try {
      const result = await api('/api/policies' + path, method, body);
      if (method !== 'DELETE' && (!result || typeof result.extension !== 'string' || typeof result.blocked !== 'boolean')) throw new ApiError('저장 응답을 확인하지 못했습니다.', true);
      message.value = '정책을 저장했습니다.';
      return result ?? true;
    } catch (error) {
      const failure = error as ApiError;
      if (failure.uncertain || failure.code === 'SESSION_REQUIRED') ready.value = false;
      message.value = failure.uncertain ? '저장 결과를 확인하지 못했습니다. 설정을 다시 불러와 주세요.' : failure.message;
      return false;
    } finally { busy.value = false; }
  }
  return { data, ready, busy, message, refresh, save };
}
