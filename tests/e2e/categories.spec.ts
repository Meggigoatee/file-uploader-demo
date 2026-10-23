import { test, expect, verificationPath } from './fixtures';

async function addMember(page: import('@playwright/test').Page, category: string, extension: string) {
  await page.getByRole('region', { name: category + ' 카테고리', exact: true }).getByRole('button', { name: category + ' 확장자 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: category + ' 확장자 추가', exact: true });
  await dialog.getByRole('textbox', { name: '확장자', exact: true }).fill(extension);
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('CATEGORY: five-item guides, read-only filters and bulk block/allow update prechecks', async ({ page, request }) => {
  await page.goto('/');
  const photos = page.getByRole('region', { name: '사진 카테고리', exact: true });
  await expect(photos.getByRole('checkbox')).toHaveCount(5);
  await page.getByLabel('파일 선택', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  await photos.getByRole('button', { name: '사진 전체 차단', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'photo.png' })).toContainText('사전 차단');
  await expect(photos).toContainText('5종 중 5종 차단');
  const input = page.getByRole('textbox', { name: '커스텀 확장자', exact: true });
  await input.fill('zip'); await page.getByRole('button', { name: '추가', exact: true }).click();
  let writes = 0; page.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'GET') writes++; });
  await page.getByLabel('카테고리별 조회 필터').selectOption('photos');
  await expect(page.getByText('표시 5개 · 전체 6/200', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'zip 차단 해제', exact: true })).toHaveCount(0);
  await page.getByLabel('카테고리별 조회 필터').selectOption('other');
  await expect(page.getByRole('button', { name: 'zip 차단 해제', exact: true })).toBeVisible();
  expect(writes).toBe(0);
  await photos.getByRole('button', { name: '사진 전체 허용', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'photo.png' })).toContainText('전송 가능');
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(1);
  await page.screenshot({ path: verificationPath('CATEGORY-03-desktop.png'), fullPage: true });
});

test('CATEGORY: custom membership persists, edits without implicit writes, delete also allows members', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '카테고리 생성', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '카테고리 이름', exact: true }).fill('개발');
  await page.getByRole('dialog').getByRole('button', { name: '생성', exact: true }).click();
  await addMember(page, '개발', 'exe'); await addMember(page, '개발', '.PDF');
  let group = page.getByRole('region', { name: '개발 카테고리', exact: true });
  await expect(group).toContainText('2종 중 0종 차단');
  await group.getByRole('button', { name: '개발 전체 차단', exact: true }).click();
  await expect(page.locator('.fixed-list').getByRole('checkbox', { name: 'exe', exact: true })).toBeChecked();
  await page.reload();
  await expect(group).toContainText('2종 중 2종 차단');
  await group.getByRole('button', { name: '개발 이름 변경', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '카테고리 이름', exact: true }).fill('개발 문서');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await addMember(page, '개발 문서', 'zip');
  group = page.getByRole('region', { name: '개발 문서 카테고리', exact: true });
  await expect(group).toContainText('3종 중 2종 차단');
  await group.getByRole('button', { name: '개발 문서 카테고리 삭제', exact: true }).click();
  await page.getByRole('dialog', { name: '카테고리 삭제', exact: true }).getByRole('button', { name: '삭제', exact: true }).click();
  await expect(group).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'exe', exact: true })).not.toBeChecked();
  await expect(page.getByText('커스텀 차단 0/200', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: verificationPath('CATEGORY-03-custom-mobile.png'), fullPage: true });
});

test('CATEGORY: real saved response loss locks editing/uploads until policy refresh', async ({ page }) => {
  await page.goto('/');
  const photos = page.getByRole('region', { name: '사진 카테고리', exact: true });
  let release!: () => void, saved!: () => void;
  const held = new Promise<void>(resolve => release = resolve), stored = new Promise<void>(resolve => saved = resolve);
  await page.route('**/api/policies/categories/photos/state', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(200); saved(); await held; await route.abort('failed');
  });
  try {
    await photos.getByRole('button', { name: '사진 전체 차단', exact: true }).click(); await stored;
    await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'exe', exact: true })).toBeDisabled();
    release();
    await expect(page.getByText(/카테고리 저장 결과를 확인하지 못했습니다/)).toBeVisible();
    await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeDisabled();
    await page.unroute('**/api/policies/categories/photos/state');
    await page.getByRole('button', { name: '정책 새로고침', exact: true }).click();
    await expect(photos).toContainText('5종 중 5종 차단');
    await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeEnabled();
    await expect(photos.getByRole('button', { name: '사진 전체 허용', exact: true })).toBeEnabled();
    await expect(page.getByText(/카테고리 저장 결과를 확인하지 못했습니다/)).toHaveCount(0);
  } finally { release(); }
});

test('CATEGORY: real app limit rejection keeps every policy and category input', async ({ page, request }) => {
  await page.goto('/');
  for (let batch = 0; batch < 4; batch++) {
    const created = await request.post('/api/policies/categories', { data: { name: '한도 준비' + batch, extensions: Array.from({ length: batch === 3 ? 49 : 50 }, (_, i) => 'x' + (batch * 50 + i)) } });
    expect(created.status()).toBe(201); const group = await created.json();
    expect((await request.patch('/api/policies/categories/' + group.id + '/state', { data: { blocked: true } })).status()).toBe(200);
  }
  await page.getByRole('button', { name: '정책 새로고침', exact: true }).click();
  const photos = page.getByRole('region', { name: '사진 카테고리', exact: true });
  await expect(photos.getByRole('button', { name: '사진 전체 차단', exact: true })).toBeEnabled();
  await photos.getByRole('button', { name: '사진 전체 차단', exact: true }).click();
  await expect(page.getByText('커스텀 확장자 200개 제한으로 전체 변경을 취소했습니다.', { exact: true })).toBeVisible();
  await expect(photos).toContainText('5종 중 0종 차단');
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(199);
});
