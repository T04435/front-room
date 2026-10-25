"use client";

import { ArrowRight, CircleAlert, Film, MapPin, Music, Sparkles, Tv } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { describeEra } from "@/lib/era";
import { birthYearOf, eraForPlace, researchInputs, researchKey, steersClear, type Person, type Suggestion } from "@/lib/person";
import type { RunEvent } from "@/lib/run-events";

const ICON = { song: Music, artist: Music, film: Film, tv: Tv, place: MapPin } as const;
const KIND = { song: "Song", artist: "Artist", film: "Film", tv: "TV", place: "Place" } as const;

/**
 * Ring a bell? (v2 brief, P0 4): Qloo looks things up only after Go for it, per place and era, and the family answers
 * card by card. Recognising is easier than recalling, so this fills the gap for families who didn't know the music at
 * 18. Yes → a love; would upset → steer clear.
 */
export function BellDeck({ initial }: { initial: Person }) {
  const [person, setPerson] = useState(initial);
  const [items, setItems] = useState<StepItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const by = birthYearOf(person)!;
  const stale = person.places.filter((pl) => person.researched[researchKey(pl, by)] !== researchInputs(person, pl));
  const ro = Boolean(person.example);
  const name = person.preferredName || "they";

  async function research() {
    setBusy(true);
    setError(null);
    setItems([]);
    try {
      const res = await fetch(`/api/people/${person.id}/research`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The look-up couldn't start (${res.status}).`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let n = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RunEvent;
          setItems((xs) => applyStepEvent(xs, event, n++));
          if (event.type === "error") setError(event.message);
        }
      }
      setPerson((await (await fetch(`/api/people/${person.id}`)).json()) as Person);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The look-up stopped. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  // Arriving from Go for it with nothing looked up yet: start straight away (once; React's dev double-mount is skipped).
  useEffect(() => {
    if (ro || started.current || !stale.length || Object.keys(person.suggestions).length) return;
    const t = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      void research();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on arrival.
  }, []);

  async function answer(card: Suggestion, a: Suggestion["answer"] | null) {
    const before = person;
    setPerson((p) => ({ ...p, suggestions: Object.fromEntries(Object.entries(p.suggestions).map(([k, cs]) => [k, cs.map((c) => (c.id === card.id ? { ...c, answer: a ?? undefined } : c))])) }));
    try {
      const res = await fetch(`/api/people/${person.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card: card.id, answer: a }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save.");
      setPerson((await res.json()) as Person);
    } catch (e) {
      setPerson(before);
      setError(e instanceof Error ? e.message : "That didn't save.");
    }
  }

  const groups = person.places
    .map((pl) => ({ place: pl, era: eraForPlace(pl, by), cards: (person.suggestions[researchKey(pl, by)] ?? []).filter((c) => c.answer === "upset" || !steersClear(person, c.title, c.by)) }))
    .filter((g) => g.cards.length);
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const answered = groups.reduce((n, g) => n + g.cards.filter((c) => c.answer).length, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Sparkles className="size-6" aria-hidden /> Ring a bell?
          </h1>
          <p className="text-muted-foreground">
            Suggestions from Qloo for the places and years in {person.preferredName ? `${person.preferredName}’s` : "their"} story. {total ? `${answered} of ${total} answered.` : ""}
          </p>
        </div>
        {!ro && (
          <Button asChild disabled={busy}>
            <Link href={`/p/${person.id}/session`}>
              Done, build the first session <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {!ro && stale.length > 0 && !busy && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {Object.keys(person.suggestions).length ? `The story changed for ${stale.map((p) => p.name).join(", ")}.` : `Ready to look up ${stale.map((p) => p.name).join(", ")}.`}
            <Button size="sm" onClick={() => void research()}>
              Go for it
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {items.length > 0 && <RunSteps items={items} />}
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {groups.map((g) => (
        <section key={g.place.id} className="grid gap-3" aria-label={`${g.place.name}, ${describeEra(g.era)}`}>
          <div>
            <h2 className="text-xl font-semibold">
              {g.place.name}, {describeEra(g.era)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {name === "they" ? "They were" : `${name} was`} {g.era.from - by} to {g.era.to - by}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.cards.map((c) => {
              const Icon = ICON[c.type];
              return (
                <Card key={c.id} className={c.answer === "yes" ? "border-primary" : c.answer === "upset" ? "border-destructive/50" : undefined}>
                  <CardContent className="grid gap-2 pt-6">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden /> {KIND[c.type]} · {c.parts.join(" · ")}
                    </span>
                    <span className="text-lg font-semibold">{c.title}</span>
                    {(c.by || c.year) && <span className="text-sm text-muted-foreground">{[c.by, c.year].filter(Boolean).join(", ")}</span>}
                    {!ro && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={c.answer === "yes" ? "default" : "outline"} aria-pressed={c.answer === "yes"} onClick={() => void answer(c, c.answer === "yes" ? null : "yes")}>
                          Yes, loved it
                        </Button>
                        <Button size="sm" variant={c.answer === "unsure" ? "secondary" : "outline"} aria-pressed={c.answer === "unsure"} onClick={() => void answer(c, c.answer === "unsure" ? null : "unsure")}>
                          Not sure
                        </Button>
                        <Button size="sm" variant={c.answer === "upset" ? "destructive" : "outline"} aria-pressed={c.answer === "upset"} onClick={() => void answer(c, c.answer === "upset" ? null : "upset")}>
                          Would upset
                        </Button>
                      </div>
                    )}
                    {c.answer && <Badge variant="outline">{c.answer === "yes" ? "Added to what they love" : c.answer === "upset" ? "Steer clear: never" : "Not sure"}</Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
      {!busy && !groups.length && !stale.length && <p className="text-muted-foreground">No suggestions yet. Add a place and years in the story, then Go for it.</p>}
    </div>
  );
}
