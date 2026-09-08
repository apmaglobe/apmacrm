import {test,expect} from '@playwright/test';
import {login} from './auth';
import {readFileSync} from 'node:fs';
const fixtures=JSON.parse(readFileSync(process.env.APMA_FIXTURE_FILE??'.local/fixture.json','utf8'));
test('manual employee: admin creates without email → login → tenant isolation → retry keeps one account',async({page,browser})=>{
 await login(page,0);await page.goto('/workspace/users');
 const observerContext=await browser.newContext(),observer=await observerContext.newPage();await login(observer,0);await observer.goto('/workspace/users');await expect(observer.getByTitle('Canlı bağlantı',{exact:true})).toBeVisible({timeout:15000});
 const name='Manual '+Date.now(),email=crypto.randomUUID()+'@example.test',password=crypto.randomUUID();
 await page.getByRole('button',{name:'Əməkdaş əlavə et',exact:true}).click();
 await page.getByLabel('Əməkdaşın adı',{exact:true}).fill(name);await page.getByLabel('Əməkdaşın emaili',{exact:true}).fill(email);await page.getByLabel('İlkin parol',{exact:false}).fill(password);await page.getByRole('dialog').getByLabel('Development',{exact:true}).check();
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/members')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Əməkdaşı yarat',exact:true}).click();const response=await responsePromise;expect(response.status()).toBe(200);const result=await response.json();
 await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('.user-card').filter({hasText:name})).toHaveCount(1);
 await expect(observer.locator('.user-card').filter({hasText:name})).toHaveCount(1,{timeout:15000});await observerContext.close();
 const input=response.request().postDataJSON();const retry=await page.request.post('/api/members',{headers:{origin:new URL(page.url()).origin},data:input});expect(retry.status()).toBe(200);expect((await retry.json()).id).toBe(result.id);
 const ctx=await browser.newContext();const member=await ctx.newPage();await member.goto('/login');await member.getByLabel('Email',{exact:true}).fill(email);await member.getByLabel('Şifrə',{exact:true}).fill(password);await member.getByRole('button',{name:'Daxil ol',exact:true}).click();await expect(member.getByRole('heading',{name:'CRM',exact:true})).toBeVisible();
 expect((await member.request.get(`/api/data?org=${fixtures[1].org}&module=crm`)).status()).toBe(403);
 const denied=await member.request.post('/api/members',{headers:{origin:new URL(member.url()).origin},data:{...input,request_id:crypto.randomUUID(),email:crypto.randomUUID()+'@example.test'}});expect(denied.status()).toBe(403);
 await member.goto('/workspace/users');await expect(member.getByRole('button',{name:'Əməkdaş əlavə et',exact:true})).toHaveCount(0);
 await ctx.close();
});
test('black theme persists across reload and portal; desktop and mobile icons are centered squares',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Temanı dəyiş',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.locator('html')).toHaveCSS('background-color','rgb(0, 0, 0)');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Yeni qutu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCSS('background-color','rgb(0, 0, 0)');
 await page.screenshot({path:'.local/black-desktop.png'});await page.getByRole('button',{name:'Bağla',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Menyu',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();
 for(const name of ['Temanı dəyiş','Çıxış','Menyu']){const button=page.getByRole('button',{name,exact:true}),box=await button.boundingBox(),icon=await button.locator('svg').boundingBox();expect(box).not.toBeNull();expect(icon).not.toBeNull();expect(box!.width).toBe(box!.height);expect(Math.abs(icon!.x+icon!.width/2-box!.x-box!.width/2)).toBeLessThan(1);expect(Math.abs(icon!.y+icon!.height/2-box!.y-box!.height/2)).toBeLessThan(1);}
 await page.screenshot({path:'.local/black-mobile.png',fullPage:true});
});
