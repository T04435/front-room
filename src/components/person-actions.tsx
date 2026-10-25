"use client";

import { Check, Copy, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { defaultGoal, GOAL_HINTS, GOAL_LABELS, GOALS, type Goal } from "@/lib/learning";

/** Copies the person's private link. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Link copied" : "Copy their link"}
    </Button>
  );
}

/** Start a session: Settle, Chat or Sing. Settle is suggested after 17:00 (the device's own clock). */
export function GoalButtons({ personId, disabled }: { personId: string; disabled?: boolean }) {
  const [suggested, setSuggested] = useState<Goal | null>(null);
  // The suggestion depends on the viewer's local time, so it's set after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSuggested(defaultGoal()), []);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {GOALS.map((g) => (
        <Button key={g} asChild={!disabled} disabled={disabled} variant={g === suggested ? "default" : "outline"} className="h-auto flex-col items-start gap-1 py-3 text-left whitespace-normal">
          {disabled ? (
            <span>{GOAL_LABELS[g]}</span>
          ) : (
            <Link href={`/p/${personId}/session?goal=${g}`}>
              <span className="flex items-center gap-1.5 font-semibold">
                <Play aria-hidden /> {GOAL_LABELS[g]}
                {g === suggested && <span className="text-xs font-normal opacity-80">· suggested now</span>}
              </span>
              <span className="text-xs font-normal opacity-80">{GOAL_HINTS[g]}</span>
            </Link>
          )}
        </Button>
      ))}
    </div>
  );
}
