"use client";

import { CircleAlert, CircleCheck, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import type { RunEvent } from "@/lib/run-events";

export type StepItem =
  | { kind: "note"; key: string; text: string }
  | { kind: "step"; key: string; title: string; running: string; status: "running" | "ok" | "failed"; summary?: string; chips: string[]; sources: string[]; sourceLine?: string; fellBack?: boolean };

/** Folds one run event into the step list. */
export function applyStepEvent(items: StepItem[], event: RunEvent, n: number): StepItem[] {
  switch (event.type) {
    case "note":
      return [...items, { kind: "note", key: `n${n}`, text: event.text }];
    case "step-start":
      return [...items.filter((x) => x.key !== event.id), { kind: "step", key: event.id, title: event.title, running: event.running, status: "running", chips: [], sources: [] }];
    case "step-end":
      return items.map((x) =>
        x.kind === "step" && x.key === event.id
          ? { ...x, status: event.ok ? "ok" : "failed", summary: event.summary, chips: event.chips, sources: event.sources, sourceLine: event.sourceLine, fellBack: event.fellBack }
          : x,
      );
    case "error":
      return items.map((x) => (x.kind === "step" && x.status === "running" ? { ...x, status: "failed" } : x));
    default:
      return items;
  }
}

const MAX_CHIPS = 6;

/** The run as shadcn's Trace: one row per research step; expand it for what came back and where from. */
export function RunSteps({ items }: { items: StepItem[] }) {
  return (
    <Trace aria-live="polite" aria-label="Research steps">
      {items.map((item) => {
        if (item.kind === "note") {
          return (
            <TraceLine key={item.key}>
              <TraceIcon>
                <MessageSquareText />
              </TraceIcon>
              <span className="min-w-0">{item.text}</span>
            </TraceLine>
          );
        }
        const source = item.fellBack ? "Qloo direct (NotOnQ didn't answer)" : item.sources.join(" + ");
        return (
          <TraceCollapsible key={item.key} defaultOpen>
            <TraceCollapsibleTrigger>
              <TraceLine status={item.status === "running" ? "running" : item.status === "failed" ? "error" : undefined}>
                <TraceIcon>{item.status === "running" ? <Spinner /> : item.status === "failed" ? <CircleAlert /> : <CircleCheck className="text-emerald-600" />}</TraceIcon>
                <TraceTitle>{item.title}</TraceTitle>
                {source && item.status !== "running" && <TraceDescription>{source}</TraceDescription>}
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
              <div className="grid gap-2 py-2 pl-6">
                <p className="text-sm text-muted-foreground">{item.status === "running" ? item.running : item.summary}</p>
                {item.chips.length > 0 && (
                  <ul className="flex flex-wrap gap-1" aria-label="Found in this step">
                    {item.chips.slice(0, MAX_CHIPS).map((c) => (
                      <li key={c}>
                        <Badge variant="secondary">{c}</Badge>
                      </li>
                    ))}
                    {item.chips.length > MAX_CHIPS && (
                      <li>
                        <Badge variant="secondary">+{item.chips.length - MAX_CHIPS}</Badge>
                      </li>
                    )}
                  </ul>
                )}
                {item.sourceLine && <p className="font-mono text-xs text-muted-foreground">{item.sourceLine}</p>}
              </div>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        );
      })}
    </Trace>
  );
}
