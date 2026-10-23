import { describe, expect, it } from 'vitest';
import { BUILTIN_CATEGORIES, CATEGORY_LIMITS, categoryInput, isCategory } from '../../shared/categories';

describe('FINAL category input boundaries', () => {
  it('accepts exact name/member/extension limits and normalizes without changing policy', () => {
    const extensions = Array.from({ length: CATEGORY_LIMITS.extensions }, (_, i) => 'x' + i);
    expect(categoryInput('가'.repeat(30), extensions)).toEqual({ name: '가'.repeat(30), extensions: [...extensions].sort() });
    expect(categoryInput(' 개발 ', ['.PDF', 'pdf', 'EXE', 'a'.repeat(20)])).toEqual({ name: '개발', extensions: ['a'.repeat(20), 'exe', 'pdf'] });
    expect(categoryInput('빈 분류', [])).toEqual({ name: '빈 분류', extensions: [] });
  });
  it.each(['', '   ', 'a'.repeat(31), 'a\u0000b', 'a\nb', 'a\u007fb', ...BUILTIN_CATEGORIES.map(c => ' ' + c.name + ' '), null, 1])('rejects invalid or reserved name %j', name => {
    expect(categoryInput(name, [])).toBeUndefined();
  });
  it.each([null, {}, 'pdf', [null], ['bad.ext'], ['한글'], ['a'.repeat(21)], ['.' + 'a'.repeat(20)], Array.from({ length: 51 }, () => 'pdf')])('rejects invalid raw membership %j', extensions => {
    expect(categoryInput('개발', extensions)).toBeUndefined();
  });
  it('recognizes valid category payloads and rejects malformed shapes or oversized membership', () => {
    const value = { id: 'group', name: '개발', builtin: false, extensions: ['exe', 'pdf'] };
    expect(isCategory(value)).toBe(true);
    for (const invalid of [null, {}, { ...value, id: 1 }, { ...value, name: null }, { ...value, builtin: 0 }, { ...value, extensions: null }, { ...value, extensions: ['PDF'] }, { ...value, extensions: [null] }, { ...value, extensions: Array.from({ length: 51 }, () => 'pdf') }]) expect(isCategory(invalid)).toBe(false);
  });
});
