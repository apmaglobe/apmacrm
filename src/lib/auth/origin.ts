import type { NextRequest } from "next/server";
/** The Host header preserves the browser hostname behind Next's local proxy. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = req.headers.get("host");
    return (
      url.origin === origin &&
      url.host === host &&
      ["https:", "http:"].includes(url.protocol) &&
      (url.protocol === "https:" ||
        process.env.NODE_ENV !== "production" ||
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}
