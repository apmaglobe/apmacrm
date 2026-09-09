import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/auth/server";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const recovery = req.nextUrl.searchParams.get("flow") === "recovery";
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(recovery?"/login?recovery=1":"/login?verified=1", req.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", req.url));
}
