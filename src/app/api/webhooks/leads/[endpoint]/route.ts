import { NextRequest, NextResponse } from "next/server";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serviceClient } from "@/lib/auth/service";
const schema = z
  .strictObject({
    external_event_id: z.string().min(1).max(200),
    customer_external_id: z.string().max(200).optional(),
    company_name: z.string().max(300).optional(),
    contact_name: z.string().max(200).optional(),
    phone: z.string().max(40).optional(),
    email: z.email().optional(),
    message: z.string().max(4000).optional(),
    source_label: z.string().max(100).optional(),
  })
  .refine((x) => !!(x.phone || x.email || (x.company_name && x.message)));
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint } = await params;
  if (!z.uuid().safeParse(endpoint).success)
    return new NextResponse(null, { status: 404 });
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
    return new NextResponse(null, { status: 415 });
  if (Number(req.headers.get("content-length")) > 262144)
    return new NextResponse(null, { status: 413 });
  const reader=req.body?.getReader();
  if(!reader)return new NextResponse(null,{status:400});
  const chunks:Uint8Array[]=[];let length=0;
  try {while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>262144){await reader.cancel();return new NextResponse(null,{status:413});}chunks.push(part.value);}}finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks).toString("utf8");
  const timestamp = req.headers.get("x-crm-timestamp") ?? "",
    signature = req.headers.get("x-crm-signature") ?? "";
  if (
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !/^[0-9a-f]{64}$/i.test(signature)
  )
    return new NextResponse(null, { status: 401 });
  const db = serviceClient();
  const stored = await db.rpc("webhook_signing_keys", {endpoint});
  const suffix = endpoint.replaceAll("-", "_");
  const secrets = [
    ...(Array.isArray(stored.data) ? stored.data as string[] : []),
    process.env["CRM_WEBHOOK_SECRET_" + suffix],
    process.env["CRM_WEBHOOK_PREVIOUS_SECRET_" + suffix],
  ].filter((s): s is string => !!s);
  if (!secrets.length)
    return NextResponse.json(
      { error: "ENDPOINT_NOT_CONFIGURED" },
      { status: 503 },
    );
  if (
    !secrets.some((secret) =>
      timingSafeEqual(
        createHmac("sha256", secret)
          .update(timestamp + "." + raw)
          .digest(),
        Buffer.from(signature, "hex"),
      ),
    )
  )
    return new NextResponse(null, { status: 401 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  const { data, error } = await db.rpc("accept_webhook", {
    endpoint,
    payload: parsed.data,
    payload_hash: createHash("sha256").update(raw).digest("hex"),
  });
  if (error) {
    const status = error.message.includes("PAYLOAD_CONFLICT")
      ? 409
      : error.message.includes("RATE_LIMIT")
        ? 429
        : 503;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "PAYLOAD_CONFLICT"
            : status === 429
              ? "RATE_LIMIT"
              : "ACCEPT_FAILED",
      },
      { status, headers: status === 429 ? { "Retry-After": "60" } : {} },
    );
  }
  return NextResponse.json({ event_id: data }, { status: 202 });
}
