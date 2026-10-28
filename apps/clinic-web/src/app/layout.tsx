import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationProgress } from "@/components/navigation-progress";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      // next-themes sets the theme class before React hydrates.
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {/* useSearchParams: rendered on the client only. */}
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
