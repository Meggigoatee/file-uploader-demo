import type { Policies } from '../shared/types';
import { blockedToken, filenameTokens, LIMITS } from '../shared/rules';
export type QueueState = 'pending' | 'preblocked' | 'sending' | 'confirming' | 'success' | 'rejected' | 'failed' | 'unconfirmed';
export interface QueueItem { id: string; file: File; state: QueueState; progress?: number; reason: string }
export function precheck(file: File, policies: Policies): string | undefined {
  if (!file.size) return '빈 파일은 업로드할 수 없습니다.';
  if (file.size > LIMITS.file) return '파일은 5 MiB 이하여야 합니다.';
  if (!filenameTokens(file.name)) return '파일명과 확장자를 확인해 주세요.';
  const blocked = new Set([...policies.fixed,...policies.custom].filter(p=>p.blocked).map(p=>p.extension));
  const token = blockedToken(file.name, blocked);
  if (token) return `${token} 확장자가 차단되어 있습니다.`;
}
export function appendFiles(current: QueueItem[], files: File[], policies: Policies): QueueItem[] {
  if (current.length + files.length > LIMITS.queue) throw new Error(`현재 ${current.length}/10개입니다. ${LIMITS.queue-current.length}개까지 추가할 수 있습니다.`);
  return [...current, ...files.map(file => {
    const reason = precheck(file,policies);
    return {id:crypto.randomUUID(), file, state:reason ? 'preblocked' as const : 'pending' as const, reason:reason ?? ''};
  })];
}
export function retryable(item: QueueItem): boolean { return ['failed','rejected','unconfirmed'].includes(item.state); }
