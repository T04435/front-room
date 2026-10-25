import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VersionBadge } from "@/components/version-badge";
import { APP_NAME } from "@/lib/app";
import { versionText } from "@/lib/version";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Reminiscence session kits for carers: the music, films, TV and places of someone's youth, worked out from their birth year and hometown.",
  other: { "app-version": versionText() },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <header className="border-b">
            <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold">
                {APP_NAME}
              </Link>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                People
              </Link>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">{children}</main>
          <footer className="border-t">
            <div className="mx-auto grid max-w-4xl gap-3 px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Taste data from Qloo. Suggestions are AI-generated, for engagement, not medical advice or treatment. Songs open on Spotify or YouTube; nothing is hosted here.
              </p>
              <div className="flex justify-center">
                <VersionBadge />
              </div>
            </div>
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
