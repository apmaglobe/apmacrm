import { test, expect } from "@playwright/test";
import { login } from "./auth";
import { readFileSync } from "node:fs";
const fixtures = JSON.parse(
  readFileSync(process.env.APMA_FIXTURE_FILE ?? ".local/fixture.json", "utf8"),
);
test("tools: create → reserve → checkout → return → broken unit", async ({
  page,
}) => {
  await login(page, 0);
  await page.goto("/workspace/tools");
  const name = "Kamera " + Date.now();
  await page
    .getByRole("button", { name: "Alət əlavə et", exact: true })
    .click();
  await page.getByLabel("Alətin adı").fill(name);
  await page.getByLabel("Növ", { exact: true }).selectOption("physical");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saxla", exact: true })
    .click();
  const tool = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await tool
    .getByRole("button", { name: "Rezervasiya et", exact: true })
    .click();
  await page.getByLabel("Başlanğıc", { exact: true }).fill("2026-09-08T01:00");
  await page.getByLabel("Son", { exact: true }).fill("2026-12-31T18:00");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Rezervasiya et", exact: true })
    .click();
  const row = page
    .locator(".work-row")
    .filter({
      has: page.getByRole("heading", {
        name: name + " · Vahid 1",
        exact: true,
      }),
    });
  await row.getByRole("button", { name: "Götür", exact: true }).click();
  await expect(row).toContainText("İstifadədə");
  await row.getByRole("button", { name: "Qaytar", exact: true }).click();
  await expect(row).toContainText("Qaytarılıb");
  await tool.getByRole("button", { name: "Vahidi düzəlt" }).click();
  await page.getByLabel("Vahidin vəziyyəti").selectOption("broken");
  await page.getByLabel("Səbəb", { exact: true }).fill("Sınaq: təmirə verildi");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saxla", exact: true })
    .click();
  await expect(tool).toContainText("broken");
});
test("meeting: mobile create with participants → calendar → ICS", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/workspace/meetings");
  const title = "Görüş " + Date.now();
  await page.getByRole("button", { name: "Görüş yarat", exact: true }).click();
  await page.getByLabel("Mövzu").fill(title);
  await page.getByLabel("Başlanğıc", { exact: true }).fill("2026-09-10T10:00");
  await page.getByLabel("Son", { exact: true }).fill("2026-09-10T11:00");
  await page
    .getByLabel("Online HTTPS link")
    .fill("https://meet.google.com/abc-defg-hij");
  await page.getByLabel("Admin", { exact: true }).check();
  const saved=page.waitForResponse(r=>r.url().endsWith("/api/command")&&r.request().method()==="POST");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saxla", exact: true })
    .click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("dialog")).not.toBeVisible({timeout:15000});
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await expect(card).toBeVisible();
  const url = await card
    .getByRole("link", { name: "Təqvimə endir" })
    .getAttribute("href");
  const r = await page.request.get(url!);
  expect(r.ok()).toBeTruthy();
  const ics = await r.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("DTSTART:20260910T060000Z");
  expect(ics).toContain(title);
  await expect(
    page.locator(".calendar-day").filter({ hasText: title }),
  ).toBeVisible();
});
test("private chat: second session message → membership removal invalidates open chat", async ({
  page,
  browser,
}) => {
  await login(page);
  const ctx = await browser.newContext();
  const second = await ctx.newPage();
  await login(second, 2);
  await page.goto("/workspace/inbox");
  await second.goto("/workspace/inbox");
  await expect(
    second.getByTitle("Canlı bağlantı", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    second.getByRole("button", { name: "Söhbət yarat" }),
  ).toBeVisible();
  const title = "Şəxsi " + Date.now();
  await page.getByRole("button", { name: "Söhbət yarat" }).click();
  await page.getByLabel("Söhbət adı").fill(title);
  await page.getByLabel("Murad", { exact: true }).check();
  const created=page.waitForResponse(r=>r.url().endsWith("/api/command")&&r.request().method()==="POST");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saxla", exact: true })
    .click();
  expect((await created).status()).toBe(200);
  const committed=Date.now();
  await expect(
    second.getByRole("button", { name: title, exact: true }),
  ).toBeVisible({timeout:15000});
  console.log("Chat conversation visible after mutation response",Date.now()-committed,"ms");
  await second.getByRole("button", { name: title, exact: true }).click();
  await expect(second.getByLabel("Mesaj", { exact: true })).toBeVisible();
  const body = "Məxfi sınaq " + Date.now();
  await page.getByLabel("Mesaj", { exact: true }).fill(body);
  await page.getByRole("button", { name: "Göndər", exact: true }).click();
  try {await expect(second.getByText(body, { exact: true })).toBeVisible({timeout:15000});}catch(error){
    const r=await second.request.get(`/api/data?org=${fixtures[0].org}&module=inbox`);const j=await r.json();const cid=j.data.conversations.find((c:{title:string})=>c.title===title).id;
    const rr=await second.request.get(`/api/data?org=${fixtures[0].org}&module=inbox&id=${cid}`);const jj=await rr.json();console.log('Chat diagnostic:',{http:rr.status(),messages:jj.data?.messages?.length,live:await second.getByTitle('Canlı bağlantı',{exact:true}).count()});throw error;
  }
  await page.getByRole("button", { name: "İştirakçıları idarə et" }).click();
  await page
    .getByLabel("Əməkdaş", { exact: true })
    .selectOption(fixtures[0].users[2].member);
  await page.getByLabel("Əməliyyat", { exact: true }).selectOption("remove");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saxla", exact: true })
    .click();
  await expect(second.getByText(body, { exact: true })).not.toBeVisible({
    timeout: 15000,
  });
  await expect(
    second.getByRole("button", { name: title, exact: true }),
  ).not.toBeVisible();
  await ctx.close();
});
test("export: all filtered 2500 rows, foreign tenant denied", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, 0);
  const org = fixtures[0].org;
  const queued=await page.request.post('/api/command',{headers:{origin:new URL(page.url()).origin},data:{org,domain:'export',operation:'create',payload:{module:'map',format:'csv',filters:{q:'Əli'}},expected_version:1,request_id:crypto.randomUUID()}});
  expect(queued.ok()).toBeTruthy();const {id}=await queued.json();
  const status=await page.request.post('/api/export/jobs',{headers:{origin:new URL(page.url()).origin},data:{org,id}});expect(status.ok()).toBeTruthy();
  await expect.poll(async()=>{const r=await page.request.get(`/api/export/jobs?org=${org}`);return (await r.json()).find((j:{id:string;status:string})=>j.id===id)?.status;},{timeout:85000,intervals:[1000,2000]}).toBe('done');
  const r=await page.request.get(`/api/export?org=${org}&job=${id}`);expect(r.status(), 'Export download HTTP status').toBe(200);
  expect((await r.text()).split('\r\n').length).toBeGreaterThan(2500);
  const foreign=await page.request.get(`/api/export?org=${fixtures[1].org}&job=${id}`);expect(foreign.status()).toBe(403);
  await page.goto('/workspace/map');await page.getByRole('button',{name:'İxrac et',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('24 saat');await expect(page.getByRole('link',{name:'Endir',exact:true}).first()).toBeVisible();
});
