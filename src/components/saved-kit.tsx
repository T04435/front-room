"use client";

import { useRouter } from "next/navigation";
import { KitView } from "@/components/kit-view";
import type { Kit, LogEntry } from "@/lib/kit";

/** A saved kit with its log; "Build again without these" opens the run page, which rebuilds from this kit's brief. */
export function SavedKit({ kit, log }: { kit: Kit; log?: LogEntry[] }) {
  const router = useRouter();
  return (
    <KitView
      kit={kit}
      log={log}
      onRebuild={(avoid) => {
        const q = new URLSearchParams({ from: kit.id });
        for (const a of avoid) q.append("avoid", a);
        router.push(`/quick?${q}`);
      }}
    />
  );
}
