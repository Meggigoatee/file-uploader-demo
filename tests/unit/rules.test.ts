import { describe, expect, it } from 'vitest';
import { blockedToken, filenameTokens, normalizeExtension } from '../../shared/rules';

describe('TC01: extension normalization', () => {
  it.each([['. SH ', 'sh'], ['PDF', 'pdf'], ['a'.repeat(20), 'a'.repeat(20)], ['7z', '7z']])('%s -> %s', (raw, expected) => expect(normalizeExtension(raw)).toBe(expected));
  it.each(['', ' ', '..sh', 'tar.gz', 'a b', 'a-b', '한글', 'K', 'a'.repeat(21), ' ' + 'a'.repeat(20), null, 1])('rejects %j', raw => expect(normalizeExtension(raw)).toBeNull());
});
describe('TC02: names and conservative dot tokens', () => {
  it.each(['문서.PDF', 'archive.tar.gz', 'report.final.pdf', 'a'.repeat(251) + '.txt', '가'.repeat(83) + 'aa.txt'])('accepts %s', name => expect(filenameTokens(name)).not.toBeNull());
  it.each(['', ' x.txt', 'x.txt ', 'x.', '.env', 'readme', 'x..txt', '../x.txt', 'x/y.txt', 'x\\y.txt', 'c:x.txt', 'x\u0000.txt', 'x\u202e.txt', 'x.한글', 'x.' + 'a'.repeat(21), 'a'.repeat(252) + '.txt', '가'.repeat(84) + '.txt'])('rejects %j', name => expect(filenameTokens(name)).toBeNull());
  it('compares every token after basename, without hidden block list or URL decoding', () => {
    expect(filenameTokens('file.EXE.txt')).toEqual(['exe', 'txt']);
    expect(blockedToken('file.EXE.txt', new Set(['exe']))).toBe('exe');
    expect(blockedToken('report.final.pdf', new Set(['final']))).toBe('final');
    expect(blockedToken('file.exe', new Set())).toBeUndefined();
    expect(blockedToken('file.%65xe.txt', new Set(['exe']))).toBeUndefined();
  });
});
