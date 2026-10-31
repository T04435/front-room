import type { Metadata } from "next";
import { JetBrains_Mono, Lexend, Young_Serif } from "next/font/google";
import { AppHeader } from "@/components/front-room/app-header";
import { SiteFooter } from "@/components/front-room/site-footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME } from "@/lib/app";
import { versionText } from "@/lib/version";
import "./globals.css";

// The design system's three faces: Young Serif for headings, Lexend for everything else, JetBrains Mono for source
// lines and the version badge.
const youngSerif = Young_Serif({ variable: "--font-young-serif", weight: "400", subsets: ["latin"] });
const lexend = Lexend({ variable: "--font-lexend", weight: ["400", "500", "600"], subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", weight: ["400", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Bring their years into the room. Tell a person's life story in a chat; Front Room finds the songs, films, TV and places of their youth, and learns what works for whoever's on next.",
  other: { "app-version": versionText() },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${youngSerif.variable} ${lexend.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">{children}</main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
