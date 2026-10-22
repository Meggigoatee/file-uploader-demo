import { test, expect, type Page } from '@playwright/test';
import { startProxy } from './proxy';

test.beforeEach(async ({ request }) => {
  const data = await (await request.get('/api/policies')).json();
  for (const p of data.fixed) await request.patch('/api/policies/fixed/'+p.extension,{data:{blocked:false}});
  for (const p of data.custom) await request.delete('/api/policies/custom/'+p.extension);
});
const file = (name: string, text='hello') => ({name,mimeType:'text/plain',buffer:Buffer.from(text)});
const row = (page: Page, name: string) => page.getByRole('listitem').filter({hasText:name});

test('TC13: mixed queue, drop, removal, whole batch limit and refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox',{name:'exe',exact:true}).check();
  await expect(page.getByText('정책을 저장했습니다.',{exact:true})).toBeVisible();
  await page.getByLabel('파일 선택', {exact:true}).setInputFiles([file('ok.txt'),file('bad.exe'),file('empty.txt','')]);
  await expect(row(page,'bad.exe')).toContainText('사전 차단');
  await expect(row(page,'empty.txt')).toContainText('빈 파일');
  await page.getByRole('button',{name:'empty.txt 목록에서 제거'}).click();
  await page.getByRole('button',{name:'업로드 시작 (1)',exact:true}).click();
  await expect(row(page,'ok.txt')).toContainText('업로드 완료');
  await expect(row(page,'bad.exe')).toContainText('사전 차단');
  const transfer = await page.evaluateHandle(() => { const d=new DataTransfer(); d.items.add(new File(['d'],'drop.txt',{type:'text/plain'})); return d; });
  await page.getByTestId('drop-zone').dispatchEvent('drop',{dataTransfer:transfer});
  await expect(row(page,'drop.txt')).toContainText('전송 가능');
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles(Array.from({length:8},(_,i)=>file('extra'+i+'.txt')));
  await expect(page.getByText(/현재 3\/10개입니다/)).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles(Array.from({length:7},(_,i)=>file('fit'+i+'.txt')));
  await expect(page.getByRole('listitem')).toHaveCount(10);
  const chooserPromise=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'파일 선택',exact:true}).click();
  await (await chooserPromise).setFiles([]);
  await expect(page.getByRole('listitem')).toHaveCount(10);
  await page.reload();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:'exe',exact:true})).toBeChecked();
});

test('TC15: real save with malformed success JSON stays unconfirmed', async ({page})=>{
  await page.route('**/api/uploads',async route=>{
    const saved=await route.fetch(); expect(saved.status()).toBe(201);
    await route.fulfill({status:201,contentType:'application/json',body:'{broken'});
  });
  await page.goto('/');
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles(file('malformed.txt'));
  await page.getByRole('button',{name:'업로드 시작 (1)',exact:true}).click();
  await expect(row(page,'malformed.txt')).toContainText('완료 확인 실패');
});

test('TC15: actual XHR timeout after real storage stays unconfirmed and stops next request', async ({page})=>{
  test.setTimeout(80000);
  let release!:()=>void;
  const held=new Promise<void>(resolve=>release=resolve);
  let count=0;
  const proxy=await startProxy(async response=>{count++; expect(response.status).toBe(201); await held; return 'send';});
  try {
    await page.goto(proxy.url);
    await page.getByLabel('파일 선택',{exact:true}).setInputFiles([file('timeout.txt'),file('not-sent.txt')]);
    await page.getByRole('button',{name:'업로드 시작 (2)',exact:true}).click();
    await expect(row(page,'timeout.txt')).toContainText('서버 확인 중');
    await expect(row(page,'timeout.txt')).toContainText('완료 확인 실패',{timeout:65000});
    await expect(row(page,'not-sent.txt')).toContainText('전송 가능');
    expect(count).toBe(1);
  } finally { release(); await proxy.close(); }
});

test('TC14/15: real write then withheld/lost response; manual retry sends failures only', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve=>release=resolve);
  let stored!: () => void;
  const confirmedStored = new Promise<void>(resolve=>stored=resolve);
  let count=0;
  const proxy = await startProxy(async response=>{
    count++;
    if (count===2) {
      expect(response.status).toBe(201);
      stored(); await held; return 'drop';
    }
    return 'send';
  });
  try {
  await page.goto(proxy.url);
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles([file('first.txt'),file('lost.txt'),file('remaining.txt')]);
  await page.getByRole('button',{name:'업로드 시작 (3)',exact:true}).click();
  await confirmedStored;
  await expect(row(page,'first.txt')).toContainText('업로드 완료');
  await expect(row(page,'lost.txt')).toContainText('서버 확인 중');
  await expect(page.getByRole('checkbox',{name:'exe',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'first.txt 목록에서 제거'})).toBeDisabled();
  release();
  await expect(row(page,'lost.txt')).toContainText('완료 확인 실패');
  await expect(row(page,'remaining.txt')).toContainText('전송 가능');
  expect(count).toBe(2);
  await page.getByRole('button',{name:'실패 파일 재시도 (1)',exact:true}).click();
  await expect(row(page,'lost.txt')).toContainText('업로드 완료');
  expect(count).toBe(3);
  await expect(row(page,'first.txt')).toContainText('업로드 완료');
  await expect(row(page,'remaining.txt')).toContainText('전송 가능');
  } finally { release(); await proxy.close(); }
});

test('TC16: failed fresh policy GET starts no upload and preserves queue', async ({ page }) => {
  let count=0;
  page.on('request',r=>{if(r.url().endsWith('/api/uploads')) count++;});
  await page.goto('/');
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles(file('waiting.txt'));
  await page.route('**/api/policies',route=>route.abort('failed'));
  await page.getByRole('button',{name:'업로드 시작 (1)',exact:true}).click();
  await expect(page.getByText(/정책을 불러오지 못했습니다/)).toBeVisible();
  expect(count).toBe(0);
  await expect(row(page,'waiting.txt')).toBeVisible();
});
