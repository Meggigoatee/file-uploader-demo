import { test, expect } from './fixtures';

test.beforeEach(async ({request}) => {
  expect((await request.post('/api/session')).status()).toBe(200);
});

test('TC11/12: policy persistence, exact registration and guide only fills input', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('checkbox', {name:'exe',exact:true})).not.toBeChecked();
  await page.getByRole('textbox',{name:'커스텀 확장자'}).fill('exe');
  await expect(page.getByText('고정 확장자 · 현재 해제',{exact:true})).toBeVisible();
  await page.getByRole('checkbox', {name:'exe',exact:true}).check();
  await expect(page.getByRole('status').filter({hasText:'정책을 저장했습니다.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox', {name:'exe',exact:true})).toBeChecked();
  const input = page.getByRole('textbox',{name:'커스텀 확장자'});
  await input.fill('exe');
  await expect(page.getByText('고정 확장자 · 현재 차단', {exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'추가',exact:true})).toBeDisabled();
  await input.fill('png');
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(0);
  await page.getByRole('button',{name:'추가',exact:true}).click();
  await expect(page.getByRole('button',{name:'png 차단 해제'})).toBeVisible();
  await input.fill('PNG');
  await expect(page.getByText('이미 커스텀 차단 목록에 등록되어 있습니다.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'png 차단 해제'}).click();
  await expect(page.getByText('커스텀 차단 0/200',{exact:true})).toBeVisible();
  await page.screenshot({path:'.docs/verification/'+(process.env.UPLOADER_VERIFICATION_PREFIX ?? 'LOCAL')+'-policy-desktop.png',fullPage:true});
});
