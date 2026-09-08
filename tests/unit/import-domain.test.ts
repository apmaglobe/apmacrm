import { test, expect } from "vitest";
import ExcelJS from "exceljs";
import { cents, utc, localInput } from "../../src/lib/domain";
import {
  parseWorkbook,
  validateRow,
  safeExportText,
} from "../../src/modules/customers/import";
import { sameOrigin } from "../../src/lib/auth/origin";
import { NextRequest } from "next/server";

test("money NULL, zero, comma and exact 50% odd-cent boundary", () => {
  expect(cents("")).toBeNull();
  expect(cents("0")).toBe(0);
  expect(cents("1000,01")).toBe(100001);
  expect(2 * cents("500")!).toBeLessThan(cents("1000.01")!);
  expect(2 * cents("500.01")!).toBeGreaterThanOrEqual(cents("1000.01")!);
  for (const value of ["-1", "1.001", "1e2", "Infinity", "90071992547409999"])
    expect(() => cents(value)).toThrow();
});
test("Baku UTC midnight round trip", () => {
  expect(utc("2026-09-08T00:00")).toBe("2026-09-07T20:00:00.000Z");
  expect(localInput(utc("2026-10-11T23:59"))).toBe("2026-10-11T23:59");
});
test("2500-row synthetic workbook preserves AZ letters, leading zero, plus, comma and blanks", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Müəssisələr");
  sheet.addRow(["Ad", "Telefon", "Enlik", "Qeyd"]);
  for (let i = 0; i < 2500; i++)
    sheet.addRow([
      "Əli Şəfəq " + i,
      i % 2 ? "+994501234567" : "0501234567",
      "40,4093",
      "",
    ]);
  const raw = await book.xlsx.writeBuffer();
  const parsed = await parseWorkbook(raw as ArrayBuffer, "synthetic.xlsx");
  expect(parsed.sheets[0].rows).toHaveLength(2501);
  expect(parsed.sheets[0].rows[1]).toEqual([
    "Əli Şəfəq 0",
    "0501234567",
    "40,4093",
    "",
  ]);
  expect(parsed.sheets[0].rows[2][1]).toBe("+994501234567");
});
test("formula cells and malformed XLSX rejected before import", async () => {
  const b = new ExcelJS.Workbook();
  b.addWorksheet("one").getCell("A1").value = {
    formula: 'HYPERLINK("https://bad.invalid")',
    result: "text",
  };
  await expect(
    parseWorkbook((await b.xlsx.writeBuffer()) as ArrayBuffer, "formula.xlsx"),
  ).rejects.toThrow(/formula/);
  await expect(
    parseWorkbook(new Uint8Array([1, 2, 3]).buffer, "malformed.xlsx"),
  ).rejects.toThrow();
});
test("CSV and field validation preserves strings; checks coordinate pairs and intervals", async () => {
  const p = await parseWorkbook(
    new TextEncoder().encode("Ad,Telefon\nƏli,+994501234567\n").buffer,
    "source.csv",
  );
  expect(p.sheets[0].rows[1][1]).toBe("+994501234567");
  expect(
    validateRow({ customer_name: "Əli", latitude: "40,4", longitude: "49.8" })
      .errors,
  ).toEqual([]);
  expect(
    validateRow({ customer_name: "Əli", latitude: "91", longitude: "49" })
      .errors.length,
  ).toBeGreaterThan(0);
  expect(
    validateRow({ customer_name: "Əli", latitude: "40" }).errors.length,
  ).toBeGreaterThan(0);
});
test("export guards formulas after whitespace", () => {
  for (const v of ["=1+1", " +1", "\t@SUM(A1)", "-3"])
    expect(safeExportText(v)).toBe("'" + v);
  expect(safeExportText("Şirkət")).toBe("Şirkət");
});
test("CSRF origin follows browser host behind Next proxy and rejects absent/foreign origin", () => {
  const request = (origin?: string) =>
    new NextRequest("http://localhost:3000/api/command", {
      headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}) },
    });
  expect(sameOrigin(request("http://127.0.0.1:3000"))).toBe(true);
  expect(sameOrigin(request("https://evil.invalid"))).toBe(false);
  expect(sameOrigin(request())).toBe(false);
  expect(sameOrigin(request("null"))).toBe(false);
});
