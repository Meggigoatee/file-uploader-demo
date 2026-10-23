import { normalizeExtension } from './rules';

export interface Category { id: string; name: string; extensions: string[]; builtin: boolean }
export const CATEGORY_LIMITS = { name: 30, extensions: 50 } as const;
export const BUILTIN_CATEGORIES: Category[] = [
  { id: 'photos', name: '사진', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'], builtin: true },
  { id: 'videos', name: '영상', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'], builtin: true },
  { id: 'audio', name: '음성', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac'], builtin: true },
  { id: 'documents', name: '문서', extensions: ['pdf', 'txt', 'docx', 'xlsx', 'pptx'], builtin: true },
];

export function categoryInput(name: unknown, extensions: unknown): { name: string; extensions: string[] } | undefined {
  if (typeof name !== 'string' || !name.trim() || name.length > CATEGORY_LIMITS.name || /[\u0000-\u001f\u007f]/.test(name) ||
      BUILTIN_CATEGORIES.some(c => c.name === name.trim()) || !Array.isArray(extensions) || extensions.length > CATEGORY_LIMITS.extensions) return;
  const normalized = extensions.map(normalizeExtension);
  if (normalized.some(e => !e)) return;
  return { name: name.trim(), extensions: [...new Set(normalized as string[])].sort() };
}

export function isCategory(value: any): value is Category {
  return !!value && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.builtin === 'boolean' &&
    Array.isArray(value.extensions) && value.extensions.length <= CATEGORY_LIMITS.extensions && value.extensions.every((e: unknown) => typeof e === 'string' && /^[a-z0-9]{1,20}$/.test(e));
}
