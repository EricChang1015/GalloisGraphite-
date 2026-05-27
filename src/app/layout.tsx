import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved by next-intl using our `src/i18n/request.ts` config which in
  // turn pulls from cookie → DB → Accept-Language → 'en'. Pre-fetching here
  // means the entire tree (server + client) shares a single locale snapshot.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground"
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
