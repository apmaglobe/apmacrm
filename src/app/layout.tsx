import {ThemeRoot} from "@/components/theme";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "APMA CRM", template: "%s · APMA CRM" },
  description: "Agentliyin satış, iş və komanda idarəetməsi",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az">
      <body><ThemeRoot/>{children}</body>
    </html>
  );
}
