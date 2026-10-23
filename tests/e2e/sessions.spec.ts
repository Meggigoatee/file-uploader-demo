import { test, expect } from '@playwright/test';

test('SESSION: fresh browser policies are independent, reload persists and tabs share the cookie', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext();
  try {
    const first = await a.newPage(), second = await b.newPage();
    await first.goto('http://127.0.0.1:4173');
    await expect(first.getByRole('checkbox', { name: 'exe', exact: true })).toBeEnabled();
    await expect(first.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await first.getByRole('checkbox', { name: 'exe', exact: true }).check();
    await expect(first.getByText('정책을 저장했습니다.', { exact: true })).toBeVisible();
    await first.getByRole('textbox', { name: '커스텀 확장자', exact: true }).fill('zip');
    await first.getByRole('button', { name: '추가', exact: true }).click();
    await expect(first.getByRole('button', { name: 'zip 차단 해제' })).toBeVisible();
    await first.reload();
    await expect(first.getByRole('checkbox', { name: 'exe', exact: true })).toBeChecked();
    await expect(first.getByRole('button', { name: 'zip 차단 해제' })).toBeVisible();
    await second.goto('http://127.0.0.1:4173');
    await expect(second.getByRole('checkbox', { name: 'exe', exact: true })).toBeEnabled();
    await expect(second.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(second.getByText('커스텀 차단 0/200', { exact: true })).toBeVisible();
    const tab = await a.newPage(); await tab.goto('http://127.0.0.1:4173');
    await expect(tab.getByRole('checkbox', { name: 'exe', exact: true })).toBeChecked();
    await expect(tab.getByRole('button', { name: 'zip 차단 해제' })).toBeVisible();
    const cookies = await a.cookies();
    expect(cookies.find(c => c.name === 'uploader_session')).toMatchObject({ httpOnly: true, sameSite: 'Lax', expires: -1 });
    const file = { name: 'demo.exe', mimeType: 'text/plain', buffer: Buffer.from('isolation') };
    expect((await a.request.post('http://127.0.0.1:4173/api/uploads', { multipart: { file } })).status()).toBe(422);
    expect((await b.request.post('http://127.0.0.1:4173/api/uploads', { multipart: { file } })).status()).toBe(201);
  } finally { await a.close(); await b.close(); }
});

test('SESSION: blocked cookies leave editing and uploads locked with a recoverable error', async ({ page, context }) => {
  await context.route('**/api/session', async route => {
    // Bootstrap response without cookie delivery; real policy GET must reject it.
    await route.fulfill({ status: 200, json: { ready: true } });
  });
  await page.goto('/');
  await expect(page.getByText(/정책을 불러오지 못했습니다/)).toBeVisible();
  await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '추가', exact: true })).toBeDisabled();
  await context.unroute('**/api/session');
  await context.clearCookies();
  await page.getByRole('button', { name: '정책 새로고침', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'exe', exact: true })).toBeEnabled();
});
