"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Copies text, even where the clipboard API is refused or missing (a phone opening the app over the LAN by IP): the
 * old select-and-copy, then a box to copy from by hand. Never fails silently (QA-28).
 */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) window.prompt("Couldn't copy by itself: select this and copy it.", text);
    return ok;
  }
}

/** Copies the person's private link. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="max-sm:h-11"
      onClick={async () => {
        if (!(await copy(`${window.location.origin}${path}`))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Link copied" : "Copy their link"}
    </Button>
  );
}

/** Copies a line of text (the care note, for the home's records). */
export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="max-sm:h-11 print:hidden"
      onClick={async () => {
        if (!(await copy(text))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : label}
    </Button>
  );
}

/** Prints the page (the What works card prints as one clean sheet for the door or the care file). */
export function PrintButton({ label = "Print the card" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" className="max-sm:h-11 print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden /> {label}
    </Button>
  );
}
