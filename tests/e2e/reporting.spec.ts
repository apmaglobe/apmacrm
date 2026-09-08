import {test,expect} from '@playwright/test';
import {login} from './auth';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(process.env.APMA_FIXTURE_FILE??'.local/fixture.json','utf8'));
test('overview date report, restricted member profile, selected customer beyond lookup page',async({page})=>{
 await login(page,0);await page.goto('/workspace/overview');await expect(page.getByRole('heading',{name:'Seçilmiş dövrdə satış'})).toBeVisible();
 await page.getByText('Tarixdən',{exact:true}).locator('input').fill('2090-01-01');await page.getByText('Tarixədək',{exact:true}).locator('input').fill('2090-01-31');await page.getByRole('button',{name:'Hesabatı göstər'}).click();await expect(page.locator('.stat').filter({hasText:'Yeni lead'})).toContainText('0');
 await page.goto('/workspace/users');await page.getByRole('button',{name:'İş fəaliyyəti',exact:true}).first().click();await expect(page.getByRole('dialog')).toContainText('Yalnız baxmaq hüququnuz');await expect(page.getByRole('dialog')).toContainText('Əməliyyat tarixçəsi');
 const r=await page.request.get(`/api/data?org=${fixture[0].org}&module=crm&board=1&pipeline=sales&q=Brauzer`);expect(r.ok()).toBeTruthy();const rows=(await r.json()).rows;expect(rows.length).toBeGreaterThan(0);expect(rows[0].customer_name).toBe('Nümunə Studio');
 await page.goto(`/workspace/crm?org=${fixture[0].org}&deal=${rows[0].id}`);await expect(page.getByRole('dialog').locator('.detail-summary')).toContainText('Nümunə Studio');
});
