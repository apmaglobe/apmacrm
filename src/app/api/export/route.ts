import {exportValue} from "@/lib/export-values";
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/auth/server";
import { safeExportText } from "@/modules/customers/import";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const org = req.nextUrl.searchParams.get("org"), job = req.nextUrl.searchParams.get("job");
  if (!org || !job) return NextResponse.json({ error: "İxrac işini yaradın." }, { status: 400 });
  const db = await serverClient();
  const { data: {user} } = await db.auth.getUser();
  if (!user) return new NextResponse(null, {status:401});
  type ExportPage={module:string;format:string;table:string;rows:Record<string,unknown>[];next_offset:number|null;next_part:number|null};
  const rawResults:{table:string;rows:Record<string,unknown>[]}[]=[];
  let section="",format="",part=0,offset=0;
  for(;;){
    const {data,error}=await db.rpc("export_page",{org,job,part_index:part,row_offset:offset});
    if(error){console.warn("export.download",{code:error.code});return NextResponse.json({error:"İxrac hazır deyil, vaxtı bitib və ya icazəniz dəyişib."},{status:error.code==="42501"?403:error.code==="57014"?503:409});}
    const page=data as ExportPage;section=page.module;format=page.format;
    let table=rawResults.find(t=>t.table===page.table);if(!table){table={table:page.table,rows:[]};rawResults.push(table);}table.rows.push(...page.rows);
    if(page.next_offset!==null){offset=page.next_offset;continue;}
    if(page.next_part!==null){part=page.next_part;offset=0;continue;}
    break;
  }
  const results=rawResults.map(t=>({...t,rows:t.rows.map(r=>exportValue(r) as Record<string,unknown>)}));
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if(req.nextUrl.searchParams.get("preview")==="1")return NextResponse.json(results.map(t=>({table:t.table,count:t.rows.length,columns:Object.keys(t.rows[0]??{}),rows:t.rows.slice(0,5)})),{headers});
  if (format === "xlsx") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    for (const { table, rows } of results) {
      const sheet = workbook.addWorksheet(table.slice(0, 31));
      const keys = rows.length ? Object.keys(rows[0]) : [];
      sheet.addRow(keys);
      for (const row of rows)
        sheet.addRow(
          keys.map((k) =>
            typeof row[k] === "number"
              ? row[k]
              : safeExportText(
                  typeof row[k] === "object"
                    ? JSON.stringify(row[k])
                    : String(row[k] ?? ""),
                ),
          ),
        );
    }
    return new NextResponse(
      (await workbook.xlsx.writeBuffer()) as ArrayBuffer,
      {
        headers: {
          ...headers,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="apma-${section}.xlsx"`,
        },
      },
    );
  }
  const rows = results[0].rows,
    keys = rows.length ? Object.keys(rows[0]) : [];
  const csv = (value: unknown) =>
    '"' +
    safeExportText(
      typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
    ).replaceAll('"', '""') +
    '"';
  return new NextResponse(
    "\ufeff" +
      [
        keys.join(","),
        ...rows.map((row) => keys.map((k) => csv(row[k])).join(",")),
      ].join("\r\n"),
    {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="apma-${section}.csv"`,
      },
    },
  );
}
