import { test, expect, type Page } from './fixtures';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const card = (page: Page, name: string) => page.getByRole('region', { name: name + ' 카테고리', exact: true });
const refresh = async (page: Page) => {
  await page.getByRole('button', { name: '정책 새로고침', exact: true }).click();
  await expect(page.getByRole('button', { name: '카테고리 생성', exact: true })).toBeEnabled();
};
test.beforeEach(async ({ request }) => { expect((await request.post('/api/session')).status()).toBe(200); });

test('FINAL UI: raw name/extension limits and normalized duplicate are blocked without mutation or truncation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '카테고리 생성', exact: true }).click();
  const dialog = page.getByRole('dialog'); const input = dialog.getByRole('textbox');
  let writes = 0;
  page.on('request', request => { if (request.url().includes('/api/policies') && request.method() !== 'GET') writes++; });
  for (const value of ['', '   ', 'a'.repeat(31), ' 사진 ']) {
    await input.fill(value); await expect(input).toHaveValue(value);
    await expect(dialog.getByRole('button', { name: '생성', exact: true })).toBeDisabled();
  }
  await input.fill('가'.repeat(30)); await expect(dialog.getByRole('button', { name: '생성', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await card(page, '사진').getByRole('button', { name: '사진 확장자 추가', exact: true }).click();
  for (const value of ['a'.repeat(21), '.' + 'a'.repeat(20), 'bad.ext']) {
    await input.fill(value); await expect(input).toHaveValue(value);
    await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeDisabled();
  }
  await input.fill('.PNG');
  await expect(dialog).toContainText('이미 이 카테고리에 등록된 확장자입니다.');
  await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeDisabled();
  await input.fill('a'.repeat(20)); await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});

test('FINAL UI: a real concurrent duplicate name keeps draft and existing data; corrected name saves', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '카테고리 생성', exact: true }).click();
  const dialog = page.getByRole('dialog'); const input = dialog.getByRole('textbox');
  await input.fill('Tools');
  expect((await request.post('/api/policies/categories', { data: { name: 'tools', extensions: ['pdf'] } })).status()).toBe(201);
  await dialog.getByRole('button', { name: '생성', exact: true }).click();
  await expect(dialog).toContainText('같은 이름의 카테고리가 있습니다.');
  await expect(input).toHaveValue('Tools');
  await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeEnabled();
  await input.fill('개발'); await dialog.getByRole('button', { name: '생성', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(card(page, 'tools').getByRole('checkbox', { name: 'pdf', exact: true })).not.toBeChecked();
  await expect(card(page, '개발')).toContainText('0종 중 0종 차단');
  await expect(card(page, '개발').getByRole('button', { name: '개발 전체 차단', exact: true })).toBeDisabled();
  await expect(card(page, '개발').getByRole('button', { name: '개발 확장자 제거', exact: true })).toBeDisabled();
});

test('FINAL UI: exact 50-member limit rejects addition, removal frees one slot and membership stays independent of blocking', async ({ page, request }) => {
  const created = await request.post('/api/policies/categories', { data: { name: '한도', extensions: Array.from({ length: 50 }, (_, i) => 'x' + i) } });
  expect(created.status()).toBe(201);
  await page.goto('/');
  const group = card(page, '한도');
  await group.getByRole('button', { name: '한도 확장자 추가', exact: true }).click();
  const dialog = page.getByRole('dialog'); const input = dialog.getByRole('textbox');
  await input.fill('zip');
  await expect(dialog).toContainText('카테고리에는 확장자를 최대 50개 등록할 수 있습니다.');
  await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await group.getByRole('button', { name: '한도 확장자 제거', exact: true }).click();
  await group.getByRole('button', { name: '한도에서 x0 제외', exact: true }).click();
  await expect(group).toContainText('49종 중 0종 차단');
  await group.getByRole('button', { name: '한도 확장자 추가', exact: true }).click();
  await input.fill('.ZIP'); await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog).not.toBeVisible(); await expect(group).toContainText('50종 중 0종 차단');
  await page.reload();
  await expect(group.getByRole('checkbox')).toHaveCount(50);
  await expect(group.getByRole('checkbox', { name: 'x0', exact: true })).toHaveCount(0);
  await expect(group.getByRole('checkbox', { name: 'zip', exact: true })).not.toBeChecked();
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(0);
});

test('FINAL UI: shared members/other filter update after removal and deleting the selected category resets filter', async ({ page, request }) => {
  const create = async (name: string, extensions: string[]) => { const r = await request.post('/api/policies/categories', { data: { name, extensions } }); expect(r.status()).toBe(201); return r.json(); };
  const first = await create('첫 분류', ['zip', 'exe']); const second = await create('겹친 분류', ['zip']);
  expect((await request.patch('/api/policies/categories/' + first.id + '/state', { data: { blocked: true } })).status()).toBe(200);
  await page.goto('/');
  const group = card(page, '첫 분류');
  await expect(card(page, '겹친 분류').getByRole('checkbox', { name: 'zip', exact: true })).toBeChecked();
  await group.getByRole('button', { name: '첫 분류 확장자 제거', exact: true }).click();
  await group.getByRole('button', { name: '첫 분류에서 exe 제외', exact: true }).click();
  await expect(group).toContainText('1종 중 1종 차단');
  await expect(page.locator('.fixed-list').getByRole('checkbox', { name: 'exe', exact: true })).toBeChecked();
  await card(page, '겹친 분류').getByRole('button', { name: '겹친 분류 확장자 제거', exact: true }).click();
  await card(page, '겹친 분류').getByRole('button', { name: '겹친 분류에서 zip 제외', exact: true }).click();
  // Removal mode belongs to one card at a time; explicitly return to the first card.
  await expect(group.getByRole('checkbox', { name: 'zip', exact: true })).toBeChecked();
  await group.getByRole('button', { name: '첫 분류 확장자 제거', exact: true }).click();
  await group.getByRole('button', { name: '첫 분류에서 zip 제외', exact: true }).click();
  await page.getByLabel('카테고리별 조회 필터').selectOption('other');
  await expect(page.getByRole('button', { name: 'zip 차단 해제', exact: true })).toBeVisible();
  await page.getByLabel('카테고리별 조회 필터').selectOption(second.id);
  await expect(page.getByText('표시 0개 · 전체 1/200', { exact: true })).toBeVisible();
  await card(page, '겹친 분류').getByRole('button', { name: '겹친 분류 카테고리 삭제', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByLabel('카테고리별 조회 필터')).toHaveValue('all');
  await expect(page.getByRole('button', { name: 'zip 차단 해제', exact: true })).toBeVisible();
  await expect(page.locator('.fixed-list').getByRole('checkbox', { name: 'exe', exact: true })).toBeChecked();
});

test('FINAL UI: duplicate individual block restores checkbox and failed category read recovers through refresh', async ({ page, request }) => {
  await page.goto('/'); const photos = card(page, '사진');
  await expect(photos.getByRole('checkbox', { name: 'png', exact: true })).toBeEnabled();
  expect((await request.post('/api/policies/custom', { data: { extension: 'png' } })).status()).toBe(201);
  await photos.getByRole('checkbox', { name: 'png', exact: true }).check();
  await expect(page.getByText('이미 등록된 확장자입니다.', { exact: true })).toBeVisible();
  await expect(photos.getByRole('checkbox', { name: 'png', exact: true })).not.toBeChecked();
  await page.route('**/api/policies/categories', route => route.abort('failed'));
  await page.getByRole('button', { name: '정책 새로고침', exact: true }).click();
  await expect(page.getByText(/카테고리를 불러오지 못했습니다/)).toBeVisible();
  await expect(page.getByRole('button', { name: '카테고리 생성', exact: true })).toBeDisabled();
  await page.unroute('**/api/policies/categories'); await refresh(page);
  await expect(photos.getByRole('checkbox', { name: 'png', exact: true })).toBeChecked();
  await expect(page.getByText(/카테고리를 불러오지 못했습니다/)).toHaveCount(0);
});

test('FINAL UI: bulk saved but follow-up policy read fails locks upload until successful refresh', async ({ page, request }) => {
  await page.goto('/'); const photos = card(page, '사진');
  await expect(photos.getByRole('button', { name: '사진 전체 차단', exact: true })).toBeEnabled();
  await page.getByLabel('파일 선택', { exact: true }).setInputFiles({ name: 'kept.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  await page.route('**/api/policies', route => route.abort('failed'));
  await photos.getByRole('button', { name: '사진 전체 차단', exact: true }).click();
  await expect(page.getByText(/정책을 불러오지 못했습니다/)).toBeVisible();
  await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeDisabled();
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(5);
  await page.unroute('**/api/policies'); await refresh(page);
  await expect(photos).toContainText('5종 중 5종 차단');
  await expect(page.getByRole('listitem').filter({ hasText: 'kept.png' })).toContainText('사전 차단');
  await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeEnabled();
});

test('FINAL UI: actual local reservation failure stops group, keeps queue and only manual retry starts a new request', async ({ page }) => {
  const execute = (sql: string) => execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'file-uploader-demo', '--local', '--persist-to', '.wrangler/e2e', '--command', sql], { windowsHide: true, stdio: 'pipe' });
  execute("CREATE TRIGGER final_reject_reservation BEFORE UPDATE ON upload_budget BEGIN SELECT RAISE(ABORT, 'local reservation failure'); END");
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/uploads')) calls++; });
  try {
    await page.goto('/'); await expect(page.getByRole('button', { name: '파일 선택', exact: true })).toBeEnabled();
    await page.getByLabel('파일 선택', { exact: true }).setInputFiles(['failed.txt', 'waiting.txt'].map(name => ({ name, mimeType: 'text/plain', buffer: Buffer.from('x') })));
    await page.getByRole('button', { name: '업로드 시작 (2)', exact: true }).click();
    const failed = page.getByRole('listitem').filter({ hasText: 'failed.txt' });
    await expect(failed).toContainText('업로드 실패');
    await expect(failed).toContainText('저장 완료를 확인할 수 없습니다.');
    await expect(page.getByRole('listitem').filter({ hasText: 'waiting.txt' })).toContainText('전송 가능');
    await expect(page.getByRole('button', { name: '실패 파일 재시도 (1)', exact: true })).toBeEnabled();
    expect(calls).toBe(1);
    execute('DROP TRIGGER final_reject_reservation');
    await page.getByRole('button', { name: '실패 파일 재시도 (1)', exact: true }).click();
    await expect(failed).toContainText('업로드 완료'); expect(calls).toBe(2);
    await expect(page.getByRole('listitem').filter({ hasText: 'waiting.txt' })).toContainText('전송 가능');
  } finally { execute('DROP TRIGGER IF EXISTS final_reject_reservation'); }
});
