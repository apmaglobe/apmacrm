import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/auth/server";
export async function GET(req: NextRequest) {
  const db = await serverClient();
  const { data: m, error } = await db
    .from("meetings")
    .select("*")
    .eq("organization_id", req.nextUrl.searchParams.get("org"))
    .eq("id", req.nextUrl.searchParams.get("id"))
    .single();
  if (error || !m) return new NextResponse(null, { status: 404 });
  const esc = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;")
      .replaceAll("\r", "");
  const dt = (s: string) =>
    new Date(s).toISOString().replace(/[-:]/g, "").replace(".000", "");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//APMA//CRM//AZ",
    "BEGIN:VEVENT",
    `UID:${m.id}@apma-crm`,
    `SEQUENCE:${m.version}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(m.starts_at)}`,
    `DTEND:${dt(m.ends_at)}`,
    `SUMMARY:${esc(m.title)}`,
    `LOCATION:${esc(m.location ?? m.url ?? "")}`,
    `DESCRIPTION:${esc(m.agenda ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meeting.ics"',
      "Cache-Control": "private,no-store",
    },
  });
}
