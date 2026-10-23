import { test, expect } from './fixtures';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

test.beforeEach(async ({request}) => {
  expect((await request.post('/api/session')).status()).toBe(200);
});
const file=(name:string)=>({name,mimeType:'text/plain',buffer:Buffer.from('x')});

test('TC11: explicit mutation rejection preserves input; real saved but lost response locks until GET', async ({page,request})=>{
  await page.goto('/');
  const input=page.getByRole('textbox',{name:'커스텀 확장자'});
  await input.fill('pdf');
  await request.post('/api/policies/custom',{data:{extension:'pdf'}});
  await page.getByRole('button',{name:'추가',exact:true}).click();
  await expect(page.getByText('이미 등록된 확장자입니다.',{exact:true})).toBeVisible();
  await expect(input).toHaveValue('pdf');
  await page.route('**/api/policies/fixed/exe',async route=>{const saved=await route.fetch(); expect(saved.status()).toBe(200); await route.abort('failed');});
  await page.getByRole('checkbox',{name:'exe',exact:true}).check();
  await expect(page.getByText('저장 결과를 확인하지 못했습니다. 설정을 다시 불러와 주세요.',{exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'exe',exact:true})).not.toBeChecked();
  await expect(page.getByRole('button',{name:'파일 선택',exact:true})).toBeDisabled();
  await page.unroute('**/api/policies/fixed/exe');
  await page.getByRole('button',{name:'정책 새로고침'}).click();
  await expect(page.getByRole('checkbox',{name:'exe',exact:true})).toBeChecked();
  await expect(page.getByRole('button',{name:'파일 선택',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'pdf 차단 해제'})).toBeVisible();
});

test('TC11: initial GET network failure stays locked, then recovery loads real policies', async ({page})=>{
  await page.route('**/api/policies',route=>route.abort('failed'));
  await page.goto('/');
  await expect(page.getByText(/정책을 불러오지 못했습니다/)).toBeVisible();
  await expect(page.getByRole('button',{name:'파일 선택',exact:true})).toBeDisabled();
  await page.unroute('**/api/policies');
  await page.getByRole('button',{name:'정책 새로고침'}).click();
  await expect(page.getByRole('checkbox',{name:'exe',exact:true})).toBeEnabled();
});

test('TC09/16: server policy rejection refreshes remaining queue and never changes completed results', async ({page,request})=>{
  let count=0;
  await page.route('**/api/uploads',async route=>{
    count++;
    if(count===1) await request.patch('/api/policies/fixed/exe',{data:{blocked:true}});
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'파일 선택',exact:true})).toBeEnabled();
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles([file('first.exe'),file('next.exe'),file('saved.txt')]);
  await page.getByRole('button',{name:'업로드 시작 (3)',exact:true}).click();
  const first=page.getByRole('listitem').filter({hasText:'first.exe'});
  await expect(first).toContainText('서버 거절');
  await expect(page.getByRole('listitem').filter({hasText:'next.exe'})).toContainText('사전 차단');
  await expect(page.getByRole('listitem').filter({hasText:'saved.txt'})).toContainText('업로드 완료');
  expect(count).toBe(2);
  await request.post('/api/policies/custom',{data:{extension:'txt'}});
  await request.patch('/api/policies/fixed/exe',{data:{blocked:false}});
  await page.getByRole('button',{name:'정책 새로고침'}).click();
  await expect(page.getByRole('listitem').filter({hasText:'saved.txt'})).toContainText('업로드 완료');
  await expect(first).toContainText('차단된 확장자(exe)');
  await expect(page.getByRole('button',{name:'first.exe 재시도'})).toBeEnabled();
});

test('TC10/16: actual local app budget exhaustion stops next request and preserves queue', async ({page})=>{
  const execute=(sql:string)=>execFileSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'d1','execute','file-uploader-demo','--local','--persist-to','.wrangler/e2e','--command',sql],{windowsHide:true,stdio:'pipe'});
  execute('UPDATE upload_budget SET reserved_puts=500');
  try {
    let count=0; page.on('request',r=>{if(r.url().endsWith('/api/uploads')) count++;});
    await page.goto('/');
    await expect(page.getByRole('button',{name:'파일 선택',exact:true})).toBeEnabled();
    await page.getByLabel('파일 선택',{exact:true}).setInputFiles([file('quota.txt'),file('waiting.txt')]);
    await page.getByRole('button',{name:'업로드 시작 (2)',exact:true}).click();
    await expect(page.getByRole('listitem').filter({hasText:'quota.txt'})).toContainText('누적 저장 예산이 소진');
    await expect(page.getByRole('listitem').filter({hasText:'waiting.txt'})).toContainText('전송 가능');
    expect(count).toBe(1);
  } finally { execute('UPDATE upload_budget SET reserved_puts=0,reserved_bytes=0'); }
});

test('TC17: keyboard add, raw length preservation and narrow layout', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const input=page.getByRole('textbox',{name:'커스텀 확장자'});
  await input.fill('a'.repeat(21));
  await expect(input).toHaveValue('a'.repeat(21));
  await expect(page.getByRole('button',{name:'추가',exact:true})).toBeDisabled();
  await input.fill('.SH'); await input.press('Enter');
  await expect(page.getByRole('button',{name:'sh 차단 해제'})).toBeVisible();
  await expect(input).toBeFocused();
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles(file('아주긴파일명'.repeat(12)+'.txt'));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'.docs/verification/'+(process.env.UPLOADER_VERIFICATION_PREFIX ?? 'LOCAL')+'-mobile.png',fullPage:true});
});
