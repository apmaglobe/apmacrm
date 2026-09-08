import {test,expect} from '@playwright/test';
import {login} from './auth';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
const fixtures=JSON.parse(readFileSync(process.env.APMA_FIXTURE_FILE??'.local/fixture.json','utf8'));
test('management: profile metadata, catalog revision and bound invitation form',async({page})=>{
 await login(page,0);await page.goto('/workspace/users');
 await page.getByRole('button',{name:'Profilimi düzəlt'}).click();await page.getByLabel('Bacarıqlar (vergüllə)',{exact:true}).fill('İdarəetmə, Analitika');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByText('İdarəetmə · Analitika',{exact:true})).toBeVisible();
 const catalog=page.locator('section').filter({has:page.getByRole('heading',{name:'Xidmət kataloqu',exact:true})});
 await catalog.getByRole('button',{name:'Əlavə et',exact:true}).click();const name='Kataloq '+Date.now();await page.getByLabel('Ad',{exact:true}).fill(name);await page.getByLabel('Departament',{exact:true}).selectOption({index:1});await page.getByLabel('Standart qiymət (AZN)').fill('150');await page.getByLabel('Alt tapşırıq şablonları (hər sətirdə bir ad)').fill('Hazırlıq\nYoxlama');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();
 const row=catalog.locator('.work-row').filter({hasText:name});await row.getByRole('button',{name:'Düzəliş',exact:true}).click();await page.getByLabel('Arxivləşdir',{exact:true}).check();await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();await expect(row).toContainText('Arxivdə');
 await page.getByRole('button',{name:'Dəvət keçidi',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(1);await page.getByLabel('Dəvət edilənin emaili').fill('pending-fixture@example.test');await page.getByRole('button',{name:'Keçid yarat',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('7 gün');
});
test('webhook: signed HTTP intake, bad signature, retry and cron creates lead',async({page})=>{
 test.setTimeout(120000);await login(page,0);const org=fixtures[0].org,origin=new URL(page.url()).origin;
 const r=await page.request.get(`/api/data?org=${org}&module=users`),j=await r.json();
 const created=await page.request.post('/api/command',{headers:{origin},data:{org,domain:'identity',operation:'webhook.save',payload:{name:'HTTP test '+Date.now(),department_id:j.data.departments[0].id,default_admin_id:fixtures[0].users[0].member,enabled:true},expected_version:1,request_id:crypto.randomUUID()}});expect(created.ok()).toBeTruthy();const ep=await created.json();
 const raw=JSON.stringify({external_event_id:'http-'+Date.now(),company_name:'Naməlum HTTP lead',message:'Sintetik sınaq'}),timestamp=String(Math.floor(Date.now()/1000));
 const headers={'Content-Type':'application/json','X-CRM-Timestamp':timestamp,'X-CRM-Signature':createHmac('sha256',ep.signing_secret).update(timestamp+'.'+raw).digest('hex')};
 const bad=await page.request.post(`/api/webhooks/leads/${ep.id}`,{headers:{...headers,'X-CRM-Signature':'0'.repeat(64)},data:raw});expect(bad.status()).toBe(401);
 const valid=await page.request.post(`/api/webhooks/leads/${ep.id}`,{headers,data:raw});expect(valid.status()).toBe(202);const event=await valid.json();
 const retry=await page.request.post(`/api/webhooks/leads/${ep.id}`,{headers,data:raw});expect((await retry.json()).event_id).toBe(event.event_id);
 await expect.poll(async()=>{const status=await page.request.get(`/api/data?org=${org}&module=users`);const d=await status.json();return d.data.webhook_events.find((e:{id:string})=>e.id===event.event_id)?.status;},{timeout:85000,intervals:[2000]}).toBe('done');
 await page.goto('/workspace/users');await expect(page.getByText(JSON.parse(raw).external_event_id,{exact:false})).toBeVisible();
});
test('monthly: create → generation → template revision keeps period snapshot → stop',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:844});await login(page,0);await page.goto('/workspace/subscriptions');
 const title='Aylıq '+Date.now(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await page.getByRole('button',{name:'Müqavilə yarat',exact:true}).click();await page.getByLabel('Müqavilə adı').fill(title);await page.getByLabel('Müəssisə axtarışı',{exact:true}).fill('Nümunə');await page.getByLabel('Müəssisə',{exact:true}).selectOption({label:"Nümunə Studio"});
 await page.getByLabel('Ümumi cavabdeh',{exact:true}).selectOption(fixtures[0].users[0].member);await page.getByLabel('İlk planlaşdırılmış ödəniş tarixi').fill(today);await page.getByLabel('Ödəniş günü (1–31)').fill(String(Number(today.slice(-2))));await page.getByLabel('İş adı',{exact:true}).fill('Aylıq icra');await page.getByLabel('Departament',{exact:true}).selectOption({index:1});await page.getByLabel('Cavabdeh',{exact:true}).selectOption(fixtures[0].users[1].member);await page.getByLabel('Qiymət (AZN)',{exact:true}).fill('500');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:title,exact:true})});await expect(card).toBeVisible();const generated=page.waitForResponse(r=>r.url().endsWith('/api/command')&&r.request().postDataJSON()?.operation==='contract.generate',{timeout:30000});await card.getByRole('button',{name:'Dövrü yoxla'}).click();expect((await generated).ok()).toBeTruthy();
 const read=async()=>{const r=await page.request.get(`/api/data?org=${fixtures[0].org}&module=subscriptions`);return (await r.json()).data;};let data=await read();const contract=data.service_contracts.find((x:{title:string})=>x.title===title);let period=data.contract_periods.find((x:{contract_id:string})=>x.contract_id===contract.id);expect(period.status).toBe('ready');const snapshot=JSON.stringify(period.template_snapshot);
 await card.getByRole('button',{name:'İş planını düzəlt'}).click();await page.getByLabel('Qiymət (AZN)',{exact:true}).fill('600');await page.getByLabel('Dəyişiklik səbəbi',{exact:true}).fill('Növbəti dövr üçün yeni qiymət');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();data=await read();period=data.contract_periods.find((x:{contract_id:string})=>x.contract_id===contract.id);expect(JSON.stringify(period.template_snapshot)).toBe(snapshot);
 await card.getByRole('button',{name:'Dayandır',exact:true}).click();await page.getByLabel('Səbəb',{exact:true}).fill('Sintetik test bitdi');const stopped=page.waitForResponse(r=>r.url().endsWith('/api/command')&&r.request().method()==='POST');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();expect((await stopped).status()).toBe(200);await expect(page.getByRole('dialog')).not.toBeVisible({timeout:15000});await expect(card).toContainText('stopped');
 await page.goto(`/workspace/crm?org=${fixtures[0].org}&deal=${period.deal_id}`);await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toContainText('Aylıq icra');
});
test('monthly recovery: failed assignee → admin plan repair → one ready period',async({page})=>{
 await login(page,0);const org=fixtures[0].org,origin=new URL(page.url()).origin;
 const data=(await (await page.request.get(`/api/data?org=${org}&module=subscriptions`)).json()).data;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const name='Bərpa '+Date.now();
 async function cmd(operation:string,payload:Record<string,unknown>,v=1){const r=await page.request.post('/api/command',{headers:{origin},data:{org,domain:'subscription',operation,payload,expected_version:v,request_id:crypto.randomUUID()}});expect(r.ok()).toBeTruthy();return r.json();}
 const c=await cmd('contract.save',{customer_id:data.customers[0].id,title:name,billing_day:Number(date.slice(-2)),first_payment_date:date,accountable_id:fixtures[0].users[0].member,works:[{name,department_id:data.departments[0].id,assignee_id:crypto.randomUUID(),amount:10000}]});await cmd('contract.generate',{id:c.id});
 const state=(await (await page.request.get(`/api/data?org=${org}&module=subscriptions`)).json()).data;const p=state.contract_periods.find((p:{contract_id:string})=>p.contract_id===c.id);expect(p.status).toBe('failed');
 await page.goto('/workspace/subscriptions');await page.locator(`[data-period-id="${p.id}"]`).getByRole('button',{name:'İş planını düzəldib bərpa et',exact:true}).click();await page.getByRole('dialog').getByLabel('Cavabdeh',{exact:true}).selectOption(fixtures[0].users[1].member);await page.getByLabel('Dəyişiklik səbəbi',{exact:true}).fill('Aktiv əməkdaş seçildi');await page.getByRole('dialog').getByRole('button',{name:'Saxla',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 const finished=(await (await page.request.get(`/api/data?org=${org}&module=subscriptions`)).json()).data.contract_periods.filter((x:{contract_id:string})=>x.contract_id===c.id);expect(finished).toHaveLength(1);expect(finished[0].status).toBe('ready');expect(finished[0].id).toBe(p.id);
});
