import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseURL = process.env.UPLOADER_BASE_URL ?? 'https://file-uploader-demo.meggigoatee.workers.dev';
const rehearsal = baseURL === 'http://127.0.0.1:4173';
const prefix = process.env.UPLOADER_VERIFICATION_PREFIX ?? (rehearsal ? 'RELEASE-20261023-rehearsal' : 'RELEASE-20261023');
const environmentPath = process.env.UPLOADER_ENVIRONMENT_REPORT ?? '.docs/verification/RELEASE-20261023-environment.json';
const privateDirectory = resolve('.wrangler/release');
const ledgerPath = resolve(privateDirectory, prefix + '-ledger.json');
const evidencePath = '.docs/verification/' + prefix + '-browser.json';
const productionURL = 'https://file-uploader-demo.meggigoatee.workers.dev';

test('RELEASE: isolated sessions, category/policy lifecycle and two tiny real uploads', async ({ browser }) => {
  test.setTimeout(120000);
  // Fail before creating a session or making a functional request if readiness is unproven.
  const environment = JSON.parse(readFileSync(environmentPath, 'utf8'));
  expect(environment.result).toBe('passed');
  expect(environment.baseURL).toBe(baseURL);
  expect(environment.stage).toBe(rehearsal ? 'local-rehearsal' : 'post-deploy');
  if (!rehearsal) {
    expect(baseURL).toBe(productionURL);
    expect(environment.deploymentVersionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.now() - Date.parse(environment.checkedAt)).toBeLessThan(30 * 60 * 1000);
  }
  const contexts: BrowserContext[] = [];
  const run = randomUUID().replaceAll('-', '').slice(0, 10);
  const custom = 'rel' + run;
  const groupName = '운영검증-' + run;
  const ledger: { run: string; sessions: string[]; uploads: { id: string; size: number; sha256: string; content: string }[] } = { run, sessions: [], uploads: [] };
  const checks: Record<string, boolean> = {};
  const saveLedger = () => { mkdirSync(privateDirectory, { recursive: true }); writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n'); };
  let attemptedUploads = 0;
  const card = (page: Page, name: string) => page.getByRole('region', { name: name + ' 카테고리', exact: true });
  const fixed = (page: Page) => page.locator('.fixed-list').getByRole('checkbox', { name: 'exe', exact: true });
  const readPolicies = async (context: BrowserContext) => { const response = await context.request.get('/api/policies'); expect(response.status()).toBe(200); return response.json(); };
  async function fresh() {
    const context = await browser.newContext({ baseURL }); contexts.push(context);
    const page = await context.newPage(); await page.goto('/');
    await expect(page.getByRole('button', { name: '카테고리 생성', exact: true })).toBeEnabled();
    const cookie = (await context.cookies(baseURL + '/api/policies')).find(c => c.name === 'uploader_session');
    expect(cookie).toMatchObject({ httpOnly: true, secure: !rehearsal, sameSite: 'Lax', path: '/api' });
    expect(cookie!.value).toMatch(/^[a-f0-9]{64}$/);
    ledger.sessions.push(createHash('sha256').update(cookie!.value).digest('hex')); saveLedger();
    const initial = await readPolicies(context);
    expect(initial.fixed).toHaveLength(7); expect(initial.fixed.every((p: any) => !p.blocked)).toBe(true); expect(initial.customCount).toBe(0);
    const response = await context.request.get('/api/policies/categories'); expect(response.status()).toBe(200);
    const { categories } = await response.json();
    expect(categories).toHaveLength(4); expect(categories.every((c: any) => c.builtin && c.extensions.length === 5)).toBe(true);
    return { context, page };
  }
  async function member(page: Page, name: string, extension: string) {
    await card(page, name).getByRole('button', { name: name + ' 확장자 추가', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: '확장자', exact: true }).fill(extension);
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  async function rejected(context: BrowserContext, name: string) {
    attemptedUploads++; expect(attemptedUploads).toBeLessThanOrEqual(4);
    const response = await context.request.post('/api/uploads', { multipart: { file: { name, mimeType: 'text/plain', buffer: Buffer.from('denied') } } });
    expect(response.status()).toBe(422); expect(await response.json()).toMatchObject({ error: { code: 'BLOCKED_EXTENSION' } });
  }
  async function stored(page: Page, name: string, content: string) {
    expect(ledger.uploads.length).toBeLessThan(2); expect(Buffer.byteLength(content)).toBeLessThanOrEqual(128);
    attemptedUploads++; expect(attemptedUploads).toBeLessThanOrEqual(4);
    await page.getByLabel('파일 선택', { exact: true }).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) });
    const pending = page.waitForResponse(r => r.url().endsWith('/api/uploads') && r.request().method() === 'POST');
    await page.getByRole('button', { name: name + ' 업로드', exact: true }).click();
    const response = await pending; const result = await response.json();
    // Preserve ownership before assertions so a malformed result cannot conceal a real object.
    if (typeof result.id === 'string' && /^[0-9a-f-]{36}$/.test(result.id)) {
      ledger.uploads.push({ id: result.id, size: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex'), content }); saveLedger();
    }
    expect(response.status()).toBe(201); expect(result).toMatchObject({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), size: Buffer.byteLength(content), requestId: expect.any(String) });
    await expect(page.getByRole('listitem').filter({ hasText: name })).toContainText('업로드 완료');
  }
  saveLedger();
  try {
    const a = await fresh(), b = await fresh();
    expect(ledger.sessions[0]).not.toBe(ledger.sessions[1]); checks.freshSessionDefaults = true;
    await a.page.getByRole('textbox', { name: '커스텀 확장자', exact: true }).fill('.' + custom.toUpperCase());
    await a.page.getByRole('button', { name: '추가', exact: true }).click();
    await expect(a.page.getByRole('button', { name: custom + ' 차단 해제', exact: true })).toBeVisible();
    expect((await a.context.request.post('/api/policies/custom', { data: { extension: custom.toUpperCase() } })).status()).toBe(409);
    expect((await a.context.request.post('/api/policies/custom', { data: { extension: 'exe' } })).status()).toBe(409);
    checks.customNormalizationDuplicateAndFixedProtection = true;

    await a.page.getByRole('button', { name: '카테고리 생성', exact: true }).click();
    await a.page.getByRole('dialog').getByRole('textbox').fill(groupName);
    await a.page.getByRole('dialog').getByRole('button', { name: '생성', exact: true }).click();
    for (const extension of ['.PDF', 'exe', 'zip']) await member(a.page, groupName, extension);
    await expect(card(a.page, groupName)).toContainText('3종 중 0종 차단');
    await card(a.page, groupName).getByRole('button', { name: groupName + ' 확장자 추가', exact: true }).click();
    await a.page.getByRole('dialog').getByRole('textbox').fill('.PDF');
    await expect(a.page.getByRole('dialog')).toContainText('이미 이 카테고리에 등록된 확장자입니다.');
    await expect(a.page.getByRole('dialog').getByRole('button', { name: '추가', exact: true })).toBeDisabled();
    await a.page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    const renamed = groupName + '-수정';
    await card(a.page, groupName).getByRole('button', { name: groupName + ' 이름 변경', exact: true }).click();
    await a.page.getByRole('dialog').getByRole('textbox').fill(renamed);
    await a.page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
    await expect(a.page.getByRole('dialog')).not.toBeVisible();
    await expect(card(a.page, renamed)).toContainText('3종 중 0종 차단');
    await a.page.reload(); await expect(card(a.page, renamed)).toContainText('3종 중 0종 차단');
    const { categories } = await (await a.context.request.get('/api/policies/categories')).json();
    const group = categories.find((c: any) => c.name === renamed); expect(group).toBeTruthy();
    expect((await b.context.request.delete('/api/policies/categories/' + group.id)).status()).toBe(404);
    checks.categoryCreateRenameMembershipPersistence = true;

    await card(a.page, renamed).getByRole('checkbox', { name: 'pdf', exact: true }).check();
    await expect(card(a.page, '문서').getByRole('checkbox', { name: 'pdf', exact: true })).toBeChecked();
    await card(a.page, renamed).getByRole('button', { name: renamed + ' 전체 차단', exact: true }).click();
    await expect(card(a.page, renamed)).toContainText('3종 중 3종 차단'); await expect(fixed(a.page)).toBeChecked();
    await a.page.getByLabel('카테고리별 조회 필터').selectOption(group.id);
    await expect(a.page.getByText('표시 2개 · 전체 3/200', { exact: true })).toBeVisible();
    let filterWrites = 0;
    const watchWrites = (r: import('@playwright/test').Request) => { if (r.url().includes('/api/') && r.method() !== 'GET') filterWrites++; };
    a.page.on('request', watchWrites);
    await a.page.getByLabel('카테고리별 조회 필터').selectOption('other');
    await expect(a.page.getByRole('button', { name: custom + ' 차단 해제', exact: true })).toBeVisible();
    await a.page.getByLabel('카테고리별 조회 필터').selectOption(group.id);
    expect(filterWrites).toBe(0); a.page.off('request', watchWrites);
    await a.page.reload(); await expect(fixed(a.page)).toBeChecked();
    await expect(card(a.page, renamed)).toContainText('3종 중 3종 차단');
    await b.page.reload(); await expect(fixed(b.page)).not.toBeChecked();
    expect((await readPolicies(b.context)).customCount).toBe(0);
    const otherGroups = await (await b.context.request.get('/api/policies/categories')).json(); expect(otherGroups.categories).toHaveLength(4);
    checks.sessionIsolationReloadAndSharedPolicies = true; checks.filtersReadOnlyAndCounts = true;

    await rejected(a.context, 'blocked.exe'); await rejected(a.context, 'blocked.pdf');
    await stored(b.page, 'isolated.pdf', 'release ' + run + ' session B');
    checks.serverBlockAndOtherSessionUpload = true;
    await card(a.page, renamed).getByRole('button', { name: renamed + ' 확장자 제거', exact: true }).click();
    await card(a.page, renamed).getByRole('button', { name: renamed + '에서 zip 제외', exact: true }).click();
    await expect(card(a.page, renamed)).toContainText('2종 중 2종 차단');
    expect((await readPolicies(a.context)).custom.some((p: any) => p.extension === 'zip')).toBe(true);
    await card(a.page, renamed).getByRole('button', { name: renamed + ' 확장자 제거', exact: true }).click();
    await card(a.page, renamed).getByRole('button', { name: renamed + ' 전체 허용', exact: true }).click();
    await expect(fixed(a.page)).not.toBeChecked();
    await stored(a.page, 'allowed.pdf', 'release ' + run + ' session A');
    checks.membershipRemovalKeepsPolicyAndBulkAllow = true;

    await card(a.page, renamed).getByRole('button', { name: renamed + ' 전체 차단', exact: true }).click();
    await expect(a.page.getByRole('listitem').filter({ hasText: 'allowed.pdf' })).toContainText('업로드 완료');
    await a.page.getByLabel('카테고리별 조회 필터').selectOption(group.id);
    await card(a.page, renamed).getByRole('button', { name: renamed + ' 카테고리 삭제', exact: true }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
    await expect(card(a.page, renamed)).toHaveCount(0);
    await expect(a.page.getByLabel('카테고리별 조회 필터')).toHaveValue('all'); await expect(fixed(a.page)).not.toBeChecked();
    const afterDelete = await readPolicies(a.context);
    expect(afterDelete.custom.map((p: any) => p.extension).sort()).toEqual([custom, 'zip'].sort());
    await a.page.getByRole('button', { name: custom + ' 차단 해제', exact: true }).click();
    await a.page.getByRole('button', { name: 'zip 차단 해제', exact: true }).click();
    await expect(a.page.getByText('커스텀 차단 0/200', { exact: true })).toBeVisible();
    expect((await readPolicies(b.context)).customCount).toBe(0);
    checks.categoryDeleteAllowsCurrentMembersAndPolicyDelete = true; checks.completedResultPreserved = true;
    await a.page.screenshot({ path: '.docs/verification/' + prefix + '-public-desktop.png', fullPage: true });
    expect(ledger.uploads).toHaveLength(2); expect(attemptedUploads).toBe(4);
    writeFileSync(evidencePath, JSON.stringify({ checkedAt: new Date().toISOString(), baseURL, result: 'passed', environmentReport: environmentPath, deploymentVersionId: environment.deploymentVersionId ?? null, run, sessionCount: ledger.sessions.length, requests: { uploadTotal: attemptedUploads, blocked: 2, stored: 2, maxFileBytes: 128, concurrency: 1, retries: 0 }, checks, uploads: ledger.uploads.map(({ id, size, sha256 }) => ({ id, size, sha256 })) }, null, 2) + '\n');
  } finally { for (const context of contexts) await context.close(); }
});
