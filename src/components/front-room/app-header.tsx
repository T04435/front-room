"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/front-room/logo";
import { Button } from "@/components/ui/button";

/** The top bar: the Logo home, and People and Add someone (ghost Buttons, aria-current on the page). */
export function AppHeader() {
  const path = usePathname();
  const current = path === "/people/new" ? "new" : path.startsWith("/people") || path.startsWith("/p/") ? "people" : null;
  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" aria-label="Front Room, home" className="rounded-md">
          <Logo size="sm" />
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          <Button asChild variant="ghost" size="sm" className="aria-[current=page]:bg-secondary">
            <Link href="/people" aria-current={current === "people" ? "page" : undefined}>
              People
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="aria-[current=page]:bg-secondary">
            <Link href="/people/new" aria-current={current === "new" ? "page" : undefined}>
              Add someone
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
