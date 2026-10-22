export const FIXED = ['bat', 'cmd', 'com', 'cpl', 'exe', 'scr', 'js'] as const;
export const LIMITS = { custom: 200, extension: 20, file: 5 * 1024 * 1024, body: 6 * 1024 * 1024, queue: 10, bytes: 256 * 1024 * 1024, puts: 500 } as const;

export function normalizeExtension(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > LIMITS.extension) return null;
  const value = raw.trim().replace(/^\./, '').trim();
  return /^[a-zA-Z0-9]{1,20}$/.test(value) ? value.toLowerCase() : null;
}

export function filenameTokens(name: string): string[] | null {
  if (!name || name !== name.trim() || new TextEncoder().encode(name).length > 255 ||
      /[\\/:\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(name) ||
      name.startsWith('.') || name.endsWith('.') || name.includes('..')) return null;
  const tokens = name.split('.').slice(1);
  if (!tokens.length || !/^[a-zA-Z0-9]{1,20}$/.test(tokens[tokens.length - 1])) return null;
  return tokens.map(token => token.toLowerCase());
}

export function blockedToken(name: string, blocked: ReadonlySet<string>): string | undefined {
  return filenameTokens(name)?.find(token => blocked.has(token));
}
