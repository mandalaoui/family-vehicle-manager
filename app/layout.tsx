import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ניהול רכבי המשפחה",
  description: "מעקב אחרי רישוי, טיפולים וקילומטראז׳ של הרכבים.",
  verification: {
    google: "bTXYzsQ3EvL6fsD0GcG-Vk3l0o6Q2_8kFT-b5X5vZxU",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="flex min-h-screen flex-col font-sans text-ink antialiased">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
