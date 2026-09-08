import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const fixtures = JSON.parse(
  readFileSync(process.env.APMA_FIXTURE_FILE ?? ".local/fixture.json", "utf8"),
);
function totp(secret: string) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase()]
    .map((c) => abc.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((x) => parseInt(x, 2)));
  const t = Buffer.alloc(8);
  t.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(t).digest();
  return ((h.readUInt32BE(h[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function login(page: Page, index = 1, org = 0) {
  const user = fixtures[org].users[index];
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Şifrə", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Daxil ol", exact: true }).click();
  if (user.totp) {
    await page.getByLabel("Təsdiq kodu").fill(totp(user.totp));
    await page.getByRole("button", { name: "Davam et", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "İki mərhələli təsdiq tamamlandı",
    );
    await page
      .getByRole("button", { name: "İş sahəsinə keç", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/workspace/);
  await expect(
    page.getByRole("heading", { name: "CRM", exact: true }),
  ).toBeVisible();
}
