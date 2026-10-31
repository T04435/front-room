import { VersionBadge } from "@/components/version-badge";

/** The footer: what Front Room is and isn't, the Qloo credit, and the version badge on the last line. */
export function SiteFooter() {
  return (
    <footer className="grid justify-items-center gap-3 border-t px-4 py-6 text-center print:hidden">
      <p className="max-w-[640px] text-[15px] text-muted-foreground">
        Front Room helps you share music and memories. It isn&apos;t music therapy or a treatment: watch how they respond, and stop if they seem upset or overwhelmed. Suggestions are AI-generated. Songs open on Spotify or YouTube;
        nothing is hosted here.
      </p>
      <p className="font-mono text-[13px] text-muted-foreground">Taste data from Qloo</p>
      <div className="flex justify-center">
        <VersionBadge />
      </div>
    </footer>
  );
}
