import { test, expect } from './fixtures';

test.beforeEach(async ({request}) => {
  expect((await request.post('/api/session')).status()).toBe(200);
});

test('UI-R01: upload above policies; add and registration lookup have independent inputs', async ({page,request})=>{
  await page.goto('/');
  await expect(page.getByRole('checkbox',{name:'exe',exact:true})).toBeEnabled();
  const upload=await page.getByRole('region',{name:'파일 업로드',exact:true}).boundingBox();
  const policy=await page.getByRole('region',{name:'확장자 차단 정책',exact:true}).boundingBox();
  expect(upload!.y+upload!.height).toBeLessThanOrEqual(policy!.y);
  expect(upload!.x).toBeCloseTo(policy!.x,0);
  expect(upload!.width).toBeCloseTo(policy!.width,0);
  await expect(page.getByRole('button',{name:'정책 새로고침',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'설정 다시 불러오기'})).toHaveCount(0);
  const add=page.getByRole('textbox',{name:'커스텀 확장자',exact:true});
  const lookup=page.getByRole('textbox',{name:'등록 여부 확인할 확장자',exact:true});
  await add.fill('zip'); await lookup.fill('exe');
  const result=page.getByRole('region',{name:'등록 여부 확인',exact:true});
  await expect(result).toContainText('고정 확장자 · 현재 해제');
  await expect(add).toHaveValue('zip');
  await add.fill('png');
  await expect(lookup).toHaveValue('exe');
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(0);
  await page.getByRole('button',{name:'추가',exact:true}).click();
  await expect(page.getByRole('button',{name:'png 차단 해제'})).toBeVisible();
  await expect(add).toHaveValue('');
  await expect(lookup).toHaveValue('exe');
  await lookup.fill('.PNG');
  await expect(result).toContainText('이미 커스텀 차단 목록에 등록되어 있습니다.');
  await lookup.press('Enter');
  expect((await (await request.get('/api/policies')).json()).customCount).toBe(1);
  await page.screenshot({path:'.docs/verification/'+(process.env.UPLOADER_VERIFICATION_PREFIX ?? 'LOCAL')+'-layout-desktop.png',fullPage:true});
});

test('UI-R01: per-file upload is left of remove, same size, sends one row and locks safely', async ({page})=>{
  await page.goto('/');
  await page.getByRole('checkbox',{name:'exe',exact:true}).check();
  await expect(page.getByText('정책을 저장했습니다.',{exact:true})).toBeVisible();
  await page.getByLabel('파일 선택',{exact:true}).setInputFiles(['one.txt','two.txt','blocked.exe'].map(name=>({name,mimeType:'text/plain',buffer:Buffer.from('x')})));
  const send=page.getByRole('button',{name:'one.txt 업로드',exact:true});
  const remove=page.getByRole('button',{name:'one.txt 목록에서 제거',exact:true});
  await expect(send).toBeEnabled();
  await expect(page.getByRole('button',{name:'blocked.exe 업로드',exact:true})).toBeDisabled();
  const sendBox=await send.boundingBox(); const removeBox=await remove.boundingBox();
  expect(sendBox!.x+sendBox!.width).toBeLessThanOrEqual(removeBox!.x);
  expect(sendBox!.width).toBeCloseTo(removeBox!.width,1);
  expect(sendBox!.height).toBeCloseTo(removeBox!.height,1);
  let release!:()=>void; const held=new Promise<void>(resolve=>release=resolve);
  let written!:()=>void; const stored=new Promise<void>(resolve=>written=resolve);
  let uploads=0; let policyReads=0;
  page.on('request',r=>{if(r.url().endsWith('/api/policies') && r.method()==='GET') policyReads++;});
  await page.route('**/api/uploads',async route=>{uploads++; const response=await route.fetch(); expect(response.status()).toBe(201); written(); await held; await route.fulfill({response});});
  try {
    await send.click(); await stored;
    await expect(remove).toBeDisabled();
    await expect(page.getByRole('button',{name:'two.txt 업로드',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'정책 새로고침',exact:true})).toBeDisabled();
    release();
    await expect(page.getByRole('listitem').filter({hasText:'one.txt'})).toContainText('업로드 완료');
    await expect(send).toBeDisabled();
    await expect(page.getByRole('button',{name:'two.txt 업로드',exact:true})).toBeEnabled();
    await expect(page.getByRole('listitem').filter({hasText:'two.txt'})).toContainText('전송 가능');
    expect(uploads).toBe(1); expect(policyReads).toBe(1);
  } finally { release(); }
});
