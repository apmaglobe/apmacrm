import { test, expect } from "@playwright/test";
import { login } from "./auth";
test("admin browser: 2500 CSV rows → private upload → mapping → preview → import → search", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, 0);
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: "Excel importu", exact: true })
    .click();
  const prefix = "browser-" + Date.now();
  const csv =
    "external_id,customer_name,phone,address,latitude,longitude\n" +
    Array.from(
      { length: 2500 },
      (_, i) =>
        `${prefix}-${i},Əli ${prefix} ${i},${i % 2 ? "+994501234567" : "0501234567"},Bakı,40.4,49.8`,
    ).join("\n");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-2500.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page
    .getByRole("button", { name: "Önbaxışı yoxla", exact: true })
    .click();
  await expect(
    page.getByText("2500 sətir · 0 xəta", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Önbaxışı tətbiq et", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "2500 sətir tətbiq edildi. Import tamamlandı.",
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Bağla", exact: true }).click();
  await page.getByLabel("Axtarış", { exact: true }).fill(`Əli ${prefix} 2499`);
  await expect(
    page.getByRole("heading", { name: `Əli ${prefix} 2499`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "+994501234567", exact: true }),
  ).toBeVisible();
});
test("mobile creator: create → drag/confirm → payment → replacement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const title = "Ödəniş " + Date.now();
  await page.getByRole("button", { name: "Yeni qutu", exact: true }).click();
  await page.getByLabel("Qutu adı", { exact: true }).fill(title);
  await page.getByLabel("Müəssisə axtarışı", { exact: true }).fill("Nümunə");
  await page
    .getByLabel("Müəssisə", { exact: true })
    .selectOption({ label: "Nümunə Studio" });
  await page.getByLabel("İş / xidmət", { exact: true }).fill(title + " iş");
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
  await page.getByRole("button", { name: "Qutunu yarat", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bağla", exact: true }).click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card.locator("select").selectOption("confirmed");
  await expect(card.locator("select")).toHaveValue("confirmed");
  await card.locator(".card-main").click();
  await page.getByRole("button", { name: "Ödəniş", exact: true }).click();
  await page
    .getByLabel("Kassa / bank", { exact: true })
    .selectOption({ label: "Sınaq bank hesabı" });
  await page.getByLabel("Məbləğ (AZN)", { exact: true }).fill("300");
  await page
    .getByRole("button", { name: "Ödənişi qeydə al", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Düzəlt", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Düzəlt", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Ödənişi düzəlt",
    exact: true,
  });
  await editor.getByLabel("Məbləğ (AZN)", { exact: true }).fill("400");
  await editor.getByLabel("Bölgü 1 məbləği (AZN)", { exact: true }).fill("400");
  await editor
    .getByLabel("Dəyişikliyin səbəbi", { exact: true })
    .fill("Qəbzə uyğun düzəliş");
  await editor.getByRole("button", { name: "Saxla", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.screenshot({ path: ".local/mobile-payment.png", fullPage: true });
});
