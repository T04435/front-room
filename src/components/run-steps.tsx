"use client";

import { CircleAlert, CircleCheck, ListMusic, MessageSquareText } from "lucide-react";
import { Cite, VIA } from "@/components/cite";
import { Spinner } from "@/components/ui/spinner";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import type { Item } from "@/lib/kit";
import type { RunEvent } from "@/lib/run-events";

export type StepItem =
  | { kind: "note"; key: string; text: string }
  | { kind: "step"; key: string; label: string; status: "running" | "ok" | "failed"; summary?: string; items: Item[]; via?: "notonq" | "qloo" | "mixed"; fellBack?: boolean }
  | { kind: "curating"; key: string; itemCount: number; done: boolean };

/** Folds one run event into the step list. */
export function applyStepEvent(items: StepItem[], event: RunEvent, n: number): StepItem[] {
  switch (event.type) {
    case "note":
      return [...items, { kind: "note", key: `n${n}`, text: event.text }];
    case "step-start":
      return [...items, { kind: "step", key: event.id, label: event.label, status: "running", items: [] }];
    case "step-end":
      return items.map((x) => (x.kind === "step" && x.key === event.id ? { ...x, status: event.ok ? "ok" : "failed", summary: event.summary, items: event.items, via: event.via, fellBack: event.fellBack } : x));
    case "curating":
      return [...items, { kind: "curating", key: "curating", itemCount: event.itemCount, done: false }];
    case "kit":
    case "error":
      return items.map((x) => (x.kind === "curating" ? { ...x, done: true } : x));
    default:
      return items;
  }
}

type Step = Extract<StepItem, { kind: "step" }>;

const viaText = (s: Step) => (s.fellBack ? "Qloo direct (NotOnQ didn't answer)" : s.via === "mixed" ? "NotOnQ and Qloo direct" : s.via ? VIA[s.via] : "Qloo");

/** The run as shadcn's Trace: one row per research step (expand it for what came back and its sources). */
export function RunSteps({ items }: { items: StepItem[] }) {
  return (
    <Trace aria-live="polite">
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
        if (item.kind === "curating") {
          return (
            <TraceLine key={item.key} status={item.done ? undefined : "running"}>
              <TraceIcon>{item.done ? <CircleCheck className="text-emerald-600" /> : <ListMusic />}</TraceIcon>
              <TraceTitle>{item.done ? `Kit built from ${item.itemCount} researched items.` : `Building the kit from ${item.itemCount} researched items…`}</TraceTitle>
              <TraceDescription>AI</TraceDescription>
            </TraceLine>
          );
        }
        return (
          <TraceCollapsible key={item.key} defaultOpen>
            <TraceCollapsibleTrigger>
              <TraceLine status={item.status === "running" ? "running" : item.status === "failed" ? "error" : undefined}>
                <TraceIcon>{item.status === "running" ? <Spinner /> : item.status === "failed" ? <CircleAlert /> : <CircleCheck className="text-emerald-600" />}</TraceIcon>
                <TraceTitle>{item.label}</TraceTitle>
                <TraceDescription>{item.status === "running" ? "Qloo" : viaText(item)}</TraceDescription>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
              <div className="grid gap-2 py-2 pl-6">
                {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
                {item.items.length > 0 && (
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-label="Found in this step">
                    {item.items.map((i) => (
                      <li key={i.ref} className="flex items-center gap-1">
                        <Cite item={i} /> {i.name}
                        {i.year ? <span className="text-muted-foreground">({i.year})</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        );
      })}
    </Trace>
  );
}
