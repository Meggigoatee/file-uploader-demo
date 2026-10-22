import { expect, it } from 'vitest';
import { appendFiles, precheck, retryable } from '../../src/queue';
import type { Policies } from '../../shared/types';
import { LIMITS } from '../../shared/rules';
const policies: Policies = {fixed:[{extension:'exe',kind:'fixed',blocked:true}],custom:[],customCount:0,limits:LIMITS};
it('TC13: appends separate IDs for identical names, including preblocked rows; rejects entire overflowing batch', () => {
  const rows = appendFiles([], [new File(['x'],'a.txt'),new File(['y'],'a.txt'),new File(['x'],'b.EXE.txt')],policies);
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map(r=>r.id)).size).toBe(3);
  expect(rows.map(r=>r.state)).toEqual(['pending','pending','preblocked']);
  rows[0].state = 'success';
  expect(() => appendFiles(rows, Array.from({length:8},()=>new File(['x'],'a.txt')), policies)).toThrow('10');
  expect(rows).toHaveLength(3);
});
it('TC13: checks empty, size, name and policy before transmission', () => {
  for (const file of [new File([],'a.txt'),new File([new Uint8Array(LIMITS.file+1)],'a.txt'),new File(['x'],'a..txt'),new File(['x'],'a.exe')]) expect(precheck(file,policies)).toBeTypeOf('string');
  expect(precheck(new File(['x'],'a.txt'),policies)).toBeUndefined();
});
it('TC15: only terminal failure rows are eligible for manual retry', () => {
  const row = {id:'a',file:new File(['x'],'a.txt'),reason:''};
  for (const state of ['success','pending','preblocked','sending','confirming'] as const) expect(retryable({...row,state})).toBe(false);
  for (const state of ['failed','rejected','unconfirmed'] as const) expect(retryable({...row,state})).toBe(true);
});
