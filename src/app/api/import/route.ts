import { sameOrigin } from "@/lib/auth/origin";
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/auth/server";
import { parseWorkbook } from "@/modules/customers/import";
import { z } from "zod";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  const input = z
    .object({ org: z.uuid(), path: z.string().max(300) })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { org, path } = input.data;
  const { data: member } = await db
    .from("memberships")
    .select("is_admin,status")
    .eq("organization_id", org)
    .eq("user_id", user.id)
    .single();
  if (
    !member?.is_admin ||
    member.status !== "active" ||
    !path.startsWith(`${org}/imports/${user.id}/`)
  )
    return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  try {
    const { data, error } = await db.storage.from("crm-private").download(path);
    if (error || !data) throw new Error("Fayl tapılmadı və ya giriş bağlıdır.");
    return NextResponse.json(
      await parseWorkbook(await data.arrayBuffer(), path),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import xətası" },
      { status: 400 },
    );
  }
}
