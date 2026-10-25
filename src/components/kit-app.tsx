"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AskCard } from "@/components/ask-card";
import { BriefForm } from "@/components/brief-form";
import { KitView } from "@/components/kit-view";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Brief, Kit } from "@/lib/kit";
import type { RunEvent } from "@/lib/run-events";

/** The page's run: the brief, the live research steps, the inline question, then the kit. */
export function KitApp() {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<StepItem[]>([]);
  const [kit, setKit] = useState<Kit | null>(null);
  const [error, setError] = useState<{ message: string; budget?: boolean } | null>(null);
  const [ask, setAsk] = useState<{ brief: Brief; event: Extract<RunEvent, { type: "ask" }> } | null>(null);
  const [done, setDone] = useState<Extract<RunEvent, { type: "done" }> | null>(null);
  const current = useRef<Brief | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  function apply(event: RunEvent, n: number) {
    setItems((xs) => applyStepEvent(xs, event, n));
    if (event.type === "ask" && current.current) setAsk({ brief: current.current, event });
    if (event.type === "kit") setKit(event.kit);
    if (event.type === "error") setError({ message: event.message, budget: event.budget });
    if (event.type === "done") setDone(event);
  }

  async function run(brief: Brief) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    current.current = brief;
    setBusy(true);
    setItems([]);
    setKit(null);
    setError(null);
    setAsk(null);
    setDone(null);
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief), signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; budget?: boolean };
        setError({ message: body.error ?? `The run couldn't start (${res.status}).`, budget: body.budget });
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let n = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) apply(JSON.parse(line) as RunEvent, n++);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError({ message: e instanceof Error ? e.message : "The run stopped." });
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  }

  function answer(answers: NonNullable<Brief["answers"]>) {
    if (!ask) return;
    void run({ ...ask.brief, answers: { ...ask.brief.answers, ...answers } });
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <h1 className="text-3xl font-semibold">A music session kit, from a birth year and a hometown</h1>
        <p className="text-muted-foreground">
          For carers and families. It works out the music, films and TV of the years someone was 15 to 25, where they grew up, then builds a 20-minute playlist with conversation prompts and a one-tap response log.
        </p>
      </section>
      <BriefForm busy={busy} onSubmit={(b) => void run(b)} />
      {items.length > 0 && <RunSteps items={items} />}
      {ask && !busy && <AskCard fields={ask.event.fields} message={ask.event.message} busy={busy} onAnswer={answer} />}
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>
            {error.message}{" "}
            {error.budget && (
              <Link href="/kits" className="underline">
                Open saved kits
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      {done && <p className="text-xs text-muted-foreground">Researched in {done.seconds} s with {done.qlooCalls} Qloo calls ({done.qlooCached} cached).</p>}
      {kit && (
        <>
          <KitView kit={kit} log={kit.id ? [] : undefined} />
          <div className="flex flex-wrap gap-2">
            {kit.id && (
              <Button asChild>
                <Link href={`/kits/${kit.id}`}>Open the saved kit</Link>
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={() => current.current && void run(current.current)}>
              <RotateCcw aria-hidden /> Build again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
