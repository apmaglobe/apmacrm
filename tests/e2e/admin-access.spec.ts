import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {login} from './auth';
const file=process.env.APMA_ACCESS_FIXTURE_FILE;
const fixture=file?JSON.parse(readFileSync(file,'utf8')):null;
test.skip(!fixture,'Requires disposable access applicants');
if(fixture&&!['local','preview'].includes(fixture.target))throw Error('Production fixtures forbidden');
async function applicant(page:Page,index:number){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(fixture.users[index].email);await page.getByLabel('Şifrə',{exact:true}).fill(fixture.users[index].password);await page.getByRole('button',{name:'Daxil ol',exact:true}).click();await expect(page.getByRole('heading',{name:'Üzvlük təsdiqi gözlənilir',exact:true})).toBeVisible();}
async function admin(page:Page){page.setDefaultTimeout(15000);await login(page,0);await page.getByRole('link',{name:'Admin panel',exact:true}).click();await expect(page.getByRole('heading',{name:'Admin panel',exact:true})).toBeVisible();}
async function createLink(page:Page,name:string,email?:string){await page.getByRole('button',{name:'Link yarat',exact:true}).click();if(email){await page.getByLabel('Link növü',{exact:true}).selectOption('email');await page.getByLabel('Dəvət edilənin emaili',{exact:true}).fill(email);}else await page.getByLabel('Linkin adı',{exact:true}).fill(name);await page.getByLabel('Etibarlılıq müddəti',{exact:true}).selectOption('1');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);const row=page.locator('.access-row').filter({has:page.getByRole('heading',{name:email??name,exact:true})});await expect(row).toBeVisible();const href=await row.getByRole('link',{name:'Aç',exact:true}).getAttribute('href');if(!href)throw Error('Generated link missing');return {row,href};}
test('admin links → pending request → Realtime → approve and workspace; expiry controls and mobile',async({page,browser,baseURL})=>{
 test.setTimeout(150000);
 await admin(page);console.log('Admin opened');
 const otherContext=await browser.newContext({baseURL,extraHTTPHeaders:process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}});
 const observer=await otherContext.newPage();await admin(observer);console.log('Observer opened');await expect(observer.getByTitle('Canlı bağlantı',{exact:true})).toBeVisible();
 const userContext=await browser.newContext({baseURL,extraHTTPHeaders:process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}});
 const applicantPage=await userContext.newPage();applicantPage.setDefaultTimeout(15000);
 try{
  const name='Team link '+Date.now(),applicantName='Join applicant '+Date.now();
  const {row,href}=await createLink(page,name);console.log('General link created');await expect(row).toContainText('1 gün qalıb');await page.context().grantPermissions(['clipboard-read','clipboard-write']);await row.getByRole('button',{name:name+' — linki kopyala',exact:true}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied.endsWith(href)).toBe(true);
  await applicant(applicantPage,0);console.log('Applicant signed in');await applicantPage.goto(href);await applicantPage.getByLabel('Ad və soyad',{exact:true}).fill(applicantName);await applicantPage.getByRole('button',{name:'Qoşulma müraciəti',exact:true}).click();await expect(applicantPage.getByText('Müraciətiniz göndərildi.',{exact:false})).toBeVisible();
  const request=observer.locator('.access-row').filter({has:observer.getByRole('heading',{name:applicantName,exact:true})});await expect(request).toBeVisible({timeout:20000});console.log('Request visible');
  await request.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await expect(request).toHaveCount(0);
  await observer.getByLabel('Müraciət vəziyyəti',{exact:true}).selectOption('approved');await expect(observer.locator('.access-row').filter({has:observer.getByRole('heading',{name:applicantName,exact:true})})).toContainText('Təsdiqlənib');
  await applicantPage.goto('/login');await applicantPage.getByRole('button',{name:'CRM-ə daxil ol',exact:true}).click();await expect(applicantPage.getByRole('heading',{name:'CRM',exact:true})).toBeVisible();
  await expect(applicantPage.getByRole('link',{name:'Admin panel',exact:true})).toHaveCount(0);const denied=await applicantPage.goto('/workspace/admin');expect(denied?.status()).toBe(404);
  await row.getByRole('button',{name:name+' — linki yenilə',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await applicantPage.goto(href);await applicantPage.getByLabel('Ad və soyad',{exact:true}).fill(applicantName);await applicantPage.getByRole('button',{name:'Qoşulma müraciəti',exact:true}).click();await expect(applicantPage.getByText('Əvvəl emailinizi təsdiqləyib',{exact:false})).toBeVisible();
  await row.getByRole('button',{name:name+' — linki ləğv et',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Linki ləğv et',exact:true}).click();await expect(row).toContainText('Ləğv edilib');await expect(row.getByRole('button',{name:/linki kopyala/})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Menyu',exact:true}).click();await expect(page.getByRole('link',{name:'Admin panel',exact:true})).toBeVisible();await page.getByRole('link',{name:'Admin panel',exact:true}).click();await page.getByRole('button',{name:'Temanı dəyiş',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.local/admin-access-mobile.png'});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.local/admin-access-desktop.png'});
 }catch(e){console.log('Access flow failure: '+(e as Error).message);throw e;}finally{await otherContext.close().catch(()=>{});await userContext.close().catch(()=>{});}
});
test('email-bound invitation creates a tracked request and rejection preserves the reason',async({page,browser,baseURL})=>{
 test.setTimeout(120000);await admin(page);const email=fixture.users[1].email;const {row,href}=await createLink(page,'',email);
 const context=await browser.newContext({baseURL,extraHTTPHeaders:process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}});const user=await context.newPage();user.setDefaultTimeout(15000);
 try{await applicant(user,1);await user.goto(href);const name='Email applicant '+Date.now();await user.getByLabel('Ad və soyad',{exact:true}).fill(name);await user.getByRole('button',{name:'Qoşulma müraciəti',exact:true}).click();
 const request=page.locator('.access-row').filter({has:page.getByRole('heading',{name,exact:true})});await expect(request).toBeVisible({timeout:20000});console.log('Request visible');await expect(row).toContainText('İstifadə edilib');
 await request.getByRole('button',{name:'Rədd et',exact:true}).click();await page.getByLabel('Rədd edilmə səbəbi',{exact:true}).fill('Sintetik test müraciəti');await page.getByRole('dialog').getByRole('button',{name:'Rədd et',exact:true}).click();await page.getByLabel('Müraciət vəziyyəti',{exact:true}).selectOption('rejected');await expect(request).toContainText('Sintetik test müraciəti');
 await user.goto('/workspace/crm');await expect(user).toHaveURL(/login$/);await expect(user.getByRole('heading',{name:'Üzvlük təsdiqi gözlənilir',exact:true})).toBeVisible();
 }catch(e){console.log('Invite flow failure: '+(e as Error).message);throw e;}finally{await context.close().catch(()=>{});}
});
