import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const recovery = req.nextUrl.searchParams.get("flow") === "recovery";
  const response = NextResponse.redirect(
    new URL(recovery ? "/login?recovery=1" : "/login?verified=1", req.url),
  );
  if (code) {
    const db = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (values) => values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          ),
        },
      },
    );
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(new URL("/login?error=link", req.url));
}
