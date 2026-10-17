import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const viewport: Viewport = {
  themeColor: "#090A0D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: { default: "Callilog — Calisthenics Performance", template: "%s · Callilog" },
  description: "Track personal bests, benchmark calisthenics strength, and follow verified athlete rankings.",
  applicationName: "Callilog",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Callilog" },
  formatDetection: { telephone: false },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="site-body min-h-screen text-zinc-100 font-sans pb-12">
      {children}
      </body>
      </html>
  );
}