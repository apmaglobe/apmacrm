import { unzipSync } from "fflate";
import { z } from "zod";
export const fields = [
  "external_id",
  "customer_name",
  "branch_name",
  "location_external_id",
  "contact_name",
  "phone",
  "email",
  "address",
  "latitude",
  "longitude",
  "category",
  "note",
] as const;
export type ImportField = (typeof fields)[number];
export type ImportRow = Partial<Record<ImportField, string>>;
export const limits = {
  bytes: 10 * 1024 * 1024,
  expanded: 50 * 1024 * 1024,
  rows: 10000,
  columns: 100,
  cell: 4000,
};
export async function parseWorkbook(
  buffer: ArrayBuffer,
  filename: string,
): Promise<{ sheets: { name: string; rows: string[][] }[] }> {
  if (buffer.byteLength > limits.bytes)
    throw new Error("Fayl 10 MB limitini keçir.");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  if (/\.xlsx$/i.test(filename)) {
    let total = 0;
    unzipSync(new Uint8Array(buffer), {
      filter(file) {
        total += file.originalSize;
        if (total > limits.expanded)
          throw new Error("Açılmış Excel 50 MB limitini keçir.");
        if (/vbaProject/i.test(file.name))
          throw new Error("Makrolu fayl qəbul edilmir.");
        return false;
      },
    });
    await workbook.xlsx.load(buffer);
  } else if (/\.csv$/i.test(filename)) {
    const { Readable } = await import("node:stream");
    await workbook.csv.read(Readable.from([Buffer.from(buffer)]), {
      map: (value: string) => value,
      parserOptions: { encoding: "utf8" },
    });
  } else throw new Error("Yalnız XLSX və UTF-8 CSV qəbul edilir.");
  let rowsCount = 0;
  return {
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rows: Array.from({ length: sheet.rowCount }, (_, i) => {
        if (++rowsCount > limits.rows + 1 || sheet.columnCount > limits.columns)
          throw new Error("Sətir və ya sütun limiti aşıldı.");
        return Array.from({ length: sheet.columnCount }, (_, j) => {
          const cell = sheet.getRow(i + 1).getCell(j + 1);
          if (cell.type === ExcelJS.ValueType.Formula)
            throw new Error(
              `${i + 1}-ci sətirdə formula var. Dəyər kimi saxlayın.`,
            );
          const s = cell.text;
          if (s.length > limits.cell)
            throw new Error("Xana 4 000 simvol limitini keçir.");
          return s;
        });
      }),
    })),
  };
}
const coordinate = (min: number, max: number) =>
  z
    .string()
    .transform((s) => (s.trim() === "" ? null : Number(s.replace(",", "."))))
    .refine((n) => n === null || (Number.isFinite(n) && n >= min && n <= max));
export function validateRow(row: ImportRow) {
  const errors: string[] = [];
  if (!row.customer_name?.trim()) errors.push("Müəssisə adı boşdur");
  const lat = coordinate(-90, 90).safeParse(row.latitude ?? "");
  const lng = coordinate(-180, 180).safeParse(row.longitude ?? "");
  if (!lat.success || !lng.success)
    errors.push("Koordinat intervalı yanlışdır");
  if (Boolean(row.latitude) !== Boolean(row.longitude))
    errors.push("Hər iki koordinatı yazın");
  if (row.email && !z.email().safeParse(row.email).success)
    errors.push("Email formatı yanlışdır");
  return {
    row: {
      ...row,
      latitude: lat.success ? lat.data : null,
      longitude: lng.success ? lng.data : null,
    },
    errors,
  };
}
export function safeExportText(value: string) {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? "'" + value : value;
}
