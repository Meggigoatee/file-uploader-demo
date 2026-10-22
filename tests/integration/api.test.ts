import { exports } from 'cloudflare:workers';
import { expect, it } from 'vitest';

it('TC05: unknown API is JSON 404 with request ID and no-store', async () => {
  const response = await exports.default.fetch('https://example.test/api/missing');
  expect(response.status).toBe(404);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' }, requestId: expect.any(String) });
});
