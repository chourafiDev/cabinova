import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, IBM_Plex_Sans_Arabic, Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { DirectionProvider } from "@/components/direction-provider";
import { Toaster } from "@/components/ui/sonner";
import { directionOf } from "@/i18n/config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationProgress } from "@/components/navigation-progress";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { template: "%s · Cabinova", default: "Cabinova" },
  description: "Votre cabinet médical en ligne.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = directionOf(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      // next-themes sets the theme class before React hydrates.
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${plexArabic.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
        <DirectionProvider dir={dir}>
        <ThemeProvider>
          {/* useSearchParams: rendered on the client only. */}
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <NuqsAdapter>
            <QueryProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </QueryProvider>
          </NuqsAdapter>
          <Toaster dir={dir} />
        </ThemeProvider>
        </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
