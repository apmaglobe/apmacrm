import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000", color: "#ffffff", fontFamily: "Arial", fontWeight: 800, letterSpacing: "-7px", fontSize: 54 }}>
      <span>APMA</span><span style={{ marginLeft: 10, letterSpacing: 0, fontSize: 28, background: "#16877b", borderRadius: 9, padding: "6px 8px" }}>CRM</span>
    </div>,
    { width: 192, height: 192 },
  );
}
