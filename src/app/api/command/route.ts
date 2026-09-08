import { sameOrigin } from "@/lib/auth/origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/auth/server";
import { errorLabels } from "@/lib/domain";
const input = z.object({
  org: z.uuid(),
  domain: z.enum([
    "identity",
    "crm",
    "import",
    "finance",
    "operations",
    "subscription",
    "export",
  ]),
  operation: z.string().max(60),
  payload: z.record(z.string(), z.unknown()),
  expected_version: z.number().int().min(0),
  request_id: z.uuid(),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  if (Number(req.headers.get("content-length")) > 12 * 1024 * 1024)
    return NextResponse.json({ error: "BODY_LIMIT" }, { status: 413 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Məlumat formatı yanlışdır." },
      { status: 400 },
    );
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Giriş edin." }, { status: 401 });
  const { domain, ...args } = parsed.data;
  const { data, error } = await db.rpc(`${domain}_command`, args);
  if (error) {
    const code = Object.keys(errorLabels).find((c) =>
      error.message.includes(c),
    );
    return NextResponse.json(
      {
        error: code
          ? errorLabels[code]
          : "Əməliyyat qəbul edilmədi. Sahələri və səlahiyyətinizi yoxlayın.",
        code:
          code ?? error.message.match(/^[A-Z_]+$/)?.[0] ?? "COMMAND_REJECTED",
      },
      {
        status:
          error.code === "40001" ? 409 : error.code === "42501" ? 403 : 400,
      },
    );
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
