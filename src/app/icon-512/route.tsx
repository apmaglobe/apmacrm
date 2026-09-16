import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000", color: "#ffffff", fontFamily: "Arial", fontWeight: 800, letterSpacing: "-18px", fontSize: 150 }}>
      <span>APMA</span><span style={{ marginLeft: 28, letterSpacing: 0, fontSize: 72, background: "#16877b", borderRadius: 24, padding: "16px 22px" }}>CRM</span>
    </div>,
    { width: 512, height: 512 },
  );
}
