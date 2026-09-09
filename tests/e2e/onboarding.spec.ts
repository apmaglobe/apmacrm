import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {totp} from './auth';
const file=process.env.APMA_LOGIN_FIXTURE_FILE;
const fixture=file?JSON.parse(readFileSync(file,'utf8')):null;
test.skip(!fixture,'Requires an explicitly prepared disposable onboarding fixture');
if(fixture&&!['local','preview'].includes(fixture.target))throw Error('Never run onboarding fixture against production');
async function passwordLogin(page:Page,index:number){
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(fixture.users[index].email);await page.getByLabel('Şifrə',{exact:true}).fill(fixture.users[index].password);await page.getByRole('button',{name:'Daxil ol',exact:true}).click();
}
test('first admin: unfinished setup → TOTP → automatic activation → reload and repeat login',async({page})=>{
 test.setTimeout(120000);
 await passwordLogin(page,0);await expect(page.getByRole('heading',{name:'Admin hesabını qoruyun',exact:true})).toBeVisible();
 await expect(page.getByLabel('Şifrə',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'CRM-ə daxil ol'})).toHaveCount(0);
 async function enroll(){const response=page.waitForResponse(r=>r.url().endsWith('/auth/v1/factors')&&r.request().method()==='POST');await page.getByRole('button',{name:'Authenticator qur',exact:true}).click();const r=await response;expect(r.status()).toBe(200);return (await r.json()).totp.secret as string;}
 await enroll();await page.reload();await expect(page.getByRole('heading',{name:'Admin hesabını qoruyun',exact:true})).toBeVisible();
 const secret=await enroll();const wrong=String((Number(totp(secret))+1)%1000000).padStart(6,'0');await page.getByLabel('Təsdiq kodu').fill(wrong);await page.getByRole('button',{name:'Davam et',exact:true}).click();await expect(page.getByRole('status')).toContainText('Təsdiq kodu qəbul edilmədi');
 const claim=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/claim_bootstrap'));await page.getByLabel('Təsdiq kodu').fill(totp(secret));await page.getByRole('button',{name:'Davam et',exact:true}).click();expect((await claim).status()).toBe(200);
 await expect(page).toHaveURL(/workspace\/crm/);await expect(page.getByRole('heading',{name:'CRM',exact:true})).toBeVisible();
 await page.goto('/workspace/users');await expect(page.getByRole('button',{name:'Əməkdaş əlavə et',exact:true})).toBeVisible();
 await page.goto('/login');await expect(page.getByRole('heading',{name:'Girişiniz təsdiqlənib',exact:true})).toBeVisible();await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);await page.reload();await expect(page.getByRole('button',{name:'CRM-ə daxil ol',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Çıxış',exact:true}).click();await passwordLogin(page,0);await expect(page.getByRole('heading',{name:'İki mərhələli təsdiq',exact:true})).toBeVisible();await expect(page.getByAltText('Authenticator QR kodu')).toHaveCount(0);
 await page.getByLabel('Təsdiq kodu').fill(totp(secret));await page.getByRole('button',{name:'Davam et',exact:true}).click();await expect(page).toHaveURL(/workspace\/crm/);await expect(page.getByRole('heading',{name:'CRM',exact:true})).toBeVisible();
});
test('unapproved account stays on a clear pending screen without a login/workspace loop',async({page})=>{
 await passwordLogin(page,1);await expect(page.getByRole('heading',{name:'Üzvlük təsdiqi gözlənilir',exact:true})).toBeVisible();await expect(page.getByLabel('Şifrə',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'İlk admini aktivləşdir',exact:true})).toHaveCount(0);
 await page.goto('/workspace/crm');await expect(page).toHaveURL(/\/login$/);await expect(page.getByRole('heading',{name:'Üzvlük təsdiqi gözlənilir',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Üzvlük təsdiqi gözlənilir',exact:true})).toBeVisible();
});
test('recovery session opens the password form, not the regular workspace entrance',async({page})=>{
 await passwordLogin(page,1);await expect(page.getByRole('heading',{name:'Üzvlük təsdiqi gözlənilir',exact:true})).toBeVisible();
 await page.goto('/login?recovery=1');await expect(page.getByRole('heading',{name:'Yeni şifrə',exact:true})).toBeVisible();
 await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Şifrə',{exact:true})).toBeVisible();
});
