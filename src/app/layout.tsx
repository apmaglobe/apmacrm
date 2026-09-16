import {ThemeRoot} from "@/components/theme";
import type { Metadata } from "next";
import "./globals.css";
import {PwaRegister} from "@/components/pwa-register";
export const metadata: Metadata = {
  title: { default: "APMA CRM", template: "%s · APMA CRM" },
  description: "Agentliyin satış, iş və komanda idarəetməsi",
  robots: { index: false, follow: false },
  applicationName: "APMA CRM",
  appleWebApp: { capable: true, title: "APMA CRM", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  icons: {
    icon: { url: "/brand/apma-icon-light-192.png", type: "image/png", sizes: "192x192" },
    apple: { url: "/brand/apma-icon-light-192.png", type: "image/png", sizes: "192x192" },
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az">
      <body><ThemeRoot/><PwaRegister/>{children}</body>
    </html>
  );
}
