import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mada Graphite — Madagascar Natural Flake Graphite",
    template: "%s | Mada Graphite",
  },
  description:
    "B2B trading platform for Madagascar natural flake graphite. From inquiry to delivery, securely on one AI-powered platform.",
  keywords: [
    "graphite",
    "Madagascar graphite",
    "flake graphite",
    "expandable graphite",
    "high purity graphite",
    "spherical graphite",
    "battery anode",
    "Mada Graphite",
    "Graphite Energy Inc",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground"
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
