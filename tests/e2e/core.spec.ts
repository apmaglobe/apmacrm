import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { login } from "./auth";
const fixtures = JSON.parse(
  readFileSync(process.env.APMA_FIXTURE_FILE ?? ".local/fixture.json", "utf8"),
);
test("desktop: login → create → confirm → todo; second session realtime", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);
  const ctx = await browser.newContext();
  const second = await ctx.newPage();
  await login(second, 0);
  await expect(
    second.getByRole("button", { name: "Yeni qutu", exact: true }),
  ).toBeVisible();
  const title = "Brauzer sınağı " + Date.now();
  await page.getByRole("button", { name: "Yeni qutu", exact: true }).click();
  await page.getByLabel("Qutu adı", { exact: true }).fill(title);
  await page.getByLabel("Müəssisə axtarışı", { exact: true }).fill("Nümunə");
  await page
    .getByLabel("Müəssisə", { exact: true })
    .selectOption({ label: "Nümunə Studio" });
  await page.getByLabel("İş / xidmət", { exact: true }).fill(title + " işi");
  await page
    .getByLabel("Departament", { exact: true })
    .selectOption({ label: "Development" });
  await page.getByLabel("İşin qiyməti (AZN)", { exact: true }).fill("1000");
  await page
    .getByLabel("İşin deadline-ı", { exact: true })
    .fill("2026-12-10T17:00");
  await page
    .getByLabel("Ümumi deadline", { exact: true })
    .fill("2026-12-10T18:00");
  const start = Date.now();
  await page.getByRole("button", { name: "Qutunu yarat", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(title + " işi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bağla", exact: true }).click();
  await expect(
    second.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  console.log(
    "Realtime visible after create click (includes mutation)",
    Date.now() - start,
    "ms",
  );
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card
    .locator(".serial")
    .dragTo(
      page.getByRole("heading", { name: "Sifariş təsdiqlənib", exact: true }),
    );
  await expect(card.locator("select")).toHaveValue("confirmed");
  await page.getByRole("link", { name: "To Do", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: title + " işi", exact: true }),
  ).toBeVisible();
  const updated=page.waitForResponse(r=>r.url().endsWith("/api/command")&&r.request().method()==="POST",{timeout:30000});
  await page
    .getByLabel(title + " işi statusu")
    .last()
    .selectOption("doing");
  expect((await updated).status()).toBe(200);
  await expect(page.getByLabel(title + " işi statusu").last()).toHaveValue(
    "doing", {timeout:15000},
  );
  await page.screenshot({ path: ".local/desktop-todo.png", fullPage: true });
  await ctx.close();
});
test("mobile 360px navigation and record form", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.getByRole("button", { name: "Menyu", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(12);
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Map", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menyu", exact: true }).click();
  await page.getByRole("link", { name: "CRM", exact: true }).click();
  await page.getByRole("button", { name: "Yeni qutu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Müəssisə", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".local/mobile-create.png", fullPage: true });
  await page.getByRole("button", { name: "Bağla", exact: true }).click();
});
test("tenant isolation via API and all 12 module routes", async ({ page }) => {
  await login(page, 0, 1);
  const foreign = await page.request.get(
    `/api/data?module=crm&org=${fixtures[0].org}`,
  );
  expect(foreign.status()).toBe(403);
  for (const mod of [
    "crm",
    "map",
    "tools",
    "finance",
    "inbox",
    "overview",
    "portfolio",
    "drive",
    "subscriptions",
    "meetings",
    "users",
    "todo",
  ]) {
    await page.goto("/workspace/" + mod);
    await expect(page.locator("main")).not.toContainText("Məlumat yüklənmədi");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(
      "Application error",
    );
  }
});
