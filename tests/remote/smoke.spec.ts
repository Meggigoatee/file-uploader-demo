import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('TC19: public browser policy persistence, actual upload and API denial', async ({page,context})=>{
  const request=context.request;
  expect((await request.post('/api/session')).status()).toBe(200);
  const suffix=Date.now().toString(36);
  const extension='verify'+suffix;
  const allowed='ok'+suffix;
  const content='remote uploader verification 2026-10-22';
  const evidence=process.env.UPLOADER_VERIFICATION_PREFIX ?? 'S8';
  const before=await request.get('/api/policies');
  expect(before.status()).toBe(200);
  expect(before.headers()['cache-control']).toBe('no-store');
  const original=await before.json();
  expect(original.fixed).toHaveLength(7);
  const exe=original.fixed.find((p:any)=>p.extension==='exe');
  let id:string|undefined;
  try {
    await page.goto('/');
    await expect(page.getByRole('button',{name:'정책 새로고침',exact:true})).toBeVisible();
    const uploadBox=await page.getByRole('region',{name:'파일 업로드',exact:true}).boundingBox();
    const policyBox=await page.getByRole('region',{name:'확장자 차단 정책',exact:true}).boundingBox();
    expect(uploadBox!.y+uploadBox!.height).toBeLessThanOrEqual(policyBox!.y);
    await page.getByRole('checkbox',{name:'exe',exact:true}).setChecked(!exe.blocked);
    await expect(page.getByText('정책을 저장했습니다.',{exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('checkbox',{name:'exe',exact:true})).toBeChecked({checked:!exe.blocked});
    const input=page.getByRole('textbox',{name:'커스텀 확장자'});
    const lookup=page.getByRole('textbox',{name:'등록 여부 확인할 확장자'});
    await lookup.fill('exe');
    await input.fill(extension); await page.getByRole('button',{name:'추가',exact:true}).click();
    await expect(page.getByRole('button',{name:extension+' 차단 해제'})).toBeVisible();
    await expect(lookup).toHaveValue('exe');
    await page.reload();
    await expect(page.getByRole('button',{name:extension+' 차단 해제'})).toBeVisible();
    const rejected=await request.post('/api/uploads',{multipart:{file:{name:'blocked.'+extension,mimeType:'image/png',buffer:Buffer.from('harmless')}}});
    expect(rejected.status()).toBe(422);
    expect(await rejected.json()).toMatchObject({error:{code:'BLOCKED_EXTENSION'}});
    await page.getByLabel('파일 선택',{exact:true}).setInputFiles({name:'remote.'+allowed,mimeType:'text/plain',buffer:Buffer.from(content)});
    const savedResponse=page.waitForResponse(r=>r.url().endsWith('/api/uploads') && r.status()===201);
    await page.getByRole('button',{name:'remote.'+allowed+' 업로드',exact:true}).click();
    const result=await (await savedResponse).json(); id=result.id;
    expect(result.size).toBe(Buffer.byteLength(content));
    await expect(page.getByRole('listitem')).toContainText('업로드 완료');
    await page.screenshot({path:'.docs/verification/'+evidence+'-public-desktop.png',fullPage:true});
    const missing=await request.get('/api/not-registered');
    expect(missing.status()).toBe(404);
    expect(missing.headers()['content-type']).toContain('application/json');
    writeFileSync('.docs/verification/'+evidence+'-remote-browser.json',JSON.stringify({time:new Date().toISOString(),url:page.url(),id,size:result.size,content,blockedStatus:rejected.status(),unknownStatus:missing.status(),fixedPersistence:true,customPersistence:true,verticalLayout:true,independentInputs:true,individualUpload:true},null,2)+'\n');
  } finally {
    await request.delete('/api/policies/custom/'+extension);
    await request.patch('/api/policies/fixed/exe',{data:{blocked:exe.blocked}});
  }
});
