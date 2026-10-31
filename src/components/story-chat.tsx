"use client";

import { ArrowDown, ArrowUp, Ban, Check, Lightbulb, Mic, MicOff, Paperclip, Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AgentMark } from "@/components/front-room/agent";
import { PlaceSearch, SteerQuestion, TextInput, YearInput } from "@/components/story-inputs";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message, MessageContent } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { birthYearOf, missingMinimum, researchInputs, researchKey, type Fact, type Person } from "@/lib/person";
import type { FamilyQuestion } from "@/lib/learning";
import { possessive, type RunEvent } from "@/lib/run-events";
import { addPlace, addSteer, applyFact, describeFact, storyPatch, uid, wouldHelpNext, yearsText, type Help } from "@/lib/story";

type Candidate = Fact & { id: string };
type Paused = FamilyQuestion;

/** One thing the Go-Between can ask for, as a typed input in its message. */
type Ask = { kind: "name" } | { kind: "born" } | { kind: "place" } | { kind: "from"; placeId: string } | { kind: "to"; placeId: string } | { kind: "steer" } | { kind: "language" };

type Msg =
  | { id: string; from: "you"; text: string }
  | { id: string; from: "agent"; text: string }
  | { id: string; from: "agent"; kind: "heard"; facts: Candidate[] }
  | { id: string; from: "agent"; kind: "painful"; fact: Candidate }
  | { id: string; from: "agent"; kind: "ask"; ask: Ask }
  | { id: string; from: "agent"; kind: "helps" }
  | { id: string; from: "agent"; kind: "help"; help: Help }
  | { id: string; from: "agent"; kind: "find" }
  | { id: string; from: "agent"; kind: "finding"; steps?: Line[] }
  | { id: string; from: "agent"; kind: "found" };

/** One line of the Go-Between's research, in its own message: what it's looking up, then what that added. */
type Line = { id: string; text: string; done: boolean; source?: string };

/**
 * What helps, from the Alzheimer's Society's "This is me": each adds a starter line to the box. `known`: the story
 * already has it, so it isn't offered.
 */
const HINTS: { label: string; starter: (n: string) => string; known: (p: Person) => boolean }[] = [
  { label: "Where they grew up", starter: (n) => `${n} grew up in `, known: (p) => p.places.length > 0 },
  { label: "Where they lived after", starter: () => "Later they lived in ", known: (p) => p.places.length > 1 },
  // Their own songs beat era picks (Playlist for Life asks these first).
  { label: "A song they always sang", starter: (n) => `${n} always sang `, known: (p) => p.loves.some((l) => l.type === "song") },
  { label: "Music, films and shows", starter: (n) => `${n} loved `, known: (p) => p.loves.some((l) => l.type !== "song") },
  { label: "What upsets them", starter: () => "Please steer clear of ", known: (p) => p.steerAsked || p.steers.length > 0 },
  { label: "What calms them", starter: () => "What calms them is ", known: (p) => Boolean(p.practical.calms) },
  { label: "Family and big moments", starter: () => "A big moment was ", known: (p) => p.moments.length > 0 },
  { label: "Their work", starter: (n) => `${n} worked as `, known: (p) => Boolean(p.practical.work) },
  { label: "Their wedding music", starter: () => "At their wedding they danced to ", known: (p) => p.moments.some((m) => m.kind === "wedding") },
  { label: "Faith", starter: () => "Faith: ", known: (p) => Boolean(p.practical.faith) },
];

/** The three most useful things still missing from the story, as ideas for the box; they change as it fills in. */
const MAX_HINTS = 3;
export const missingHints = (p: Person) => HINTS.filter((h) => !h.known(p)).slice(0, MAX_HINTS);

const id = () => Math.random().toString(36).slice(2, 10);

/** The next single thing to ask for, most needed first: the minimum, then years at each place, then steer-clear. */
function nextAsk(p: Person): Ask | null {
  if (!p.preferredName.trim()) return { kind: "name" };
  if (birthYearOf(p) === null) return { kind: "born" };
  if (!p.places.length) return { kind: "place" };
  // Never "when did they move to" a place they grew up in (A15).
  const noFrom = p.places.find((x, i) => x.fromYear === null && i > 0 && !x.yearsUnknown && !/grew|born|raised|childhood|crec|naci/i.test(x.role ?? ""));
  if (noFrom) return { kind: "from", placeId: noFrom.id };
  const noTo = p.places.find((x, i) => x.toYear === null && i < p.places.length - 1 && !x.yearsUnknown);
  if (noTo) return { kind: "to", placeId: noTo.id };
  if (!p.steerAsked && !p.steers.length) return { kind: "steer" };
  // The language they grew up speaking: some return to it, and a few words in it can reach them (PR-10).
  if (!p.languages.length) return { kind: "language" };
  return null;
}

/** Whether an ask is still open for this person (it may have been answered in a story told since). */
/** What a later message already said for an ask (FC-8): "1938" for "Roughly when was Iris born?", before it's confirmed. */
function toldSince(ask: Ask, msgs: Msg[], from: number): string | null {
  const kinds: Partial<Record<Ask["kind"], Fact["kind"][]>> = { name: ["preferredName"], born: ["birthYear", "decade"], place: ["place"], language: ["language"] };
  const want = kinds[ask.kind];
  if (!want) return null;
  for (const m of msgs.slice(from + 1)) {
    if (!("kind" in m) || m.kind !== "heard") continue;
    const f = m.facts.find((x) => want.includes(x.kind));
    if (f) return f.kind === "decade" ? `The ${f.fromYear ?? f.value}s` : f.kind === "birthYear" ? String(f.fromYear ?? f.value) : f.value;
  }
  return null;
}

function stillNeeded(ask: Ask, p: Person): boolean {
  if (ask.kind === "name") return !p.preferredName.trim();
  if (ask.kind === "born") return birthYearOf(p) === null;
  if (ask.kind === "place") return !p.places.length;
  if (ask.kind === "steer") return !p.steerAsked && !p.steers.length;
  if (ask.kind === "language") return !p.languages.length;
  const pl = p.places.find((x) => x.id === ask.placeId);
  return Boolean(pl && !pl.yearsUnknown && (ask.kind === "from" ? pl.fromYear === null : pl.toYear === null));
}

/**
 * The story chat: a conversation with the Go-Between. It says what helps (the "This is me" themes), then the family
 * talks, types or pastes in any order. Each time, it replies with what it heard (to confirm; only confirmed facts are
 * kept, the words are not), a steer-clear question for anything painful, and one question that digs into what was
 * said. When it knows enough it offers to find things for them with Qloo, right here, then opens their gallery.
 */
export function StoryChat({ initial, paused, provenCalm, autoFind, starter }: { initial: Person; paused: Paused[]; provenCalm: number; autoFind?: boolean; starter?: string }) {
  const [person, setPerson] = useState(initial);
  const [text, setText] = useState(starter ?? "");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    ...opening(initial, paused),
    ...(starter ? [{ id: "example", from: "agent" as const, text: `This is a fictional example: ${initial.preferredName}'s “This is me” is in the box below. Edit it if you like, then press Send.` }] : []),
  ]);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The sticky composer's height: what scrolls into view stops above it, never under it (FC-2).
  const composerBox = useRef<HTMLDivElement>(null);
  const [composerH, setComposerH] = useState(160);
  useEffect(() => {
    const el = composerBox.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setComposerH(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** A photo or PDF of a paper "This is me": the model writes out what it says, into the box to check and send. */
  async function readFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file || busy) return;
    setBusy(true);
    say(`Reading ${file.type === "application/pdf" ? "the PDF" : "the photo"}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/people/${person.id}/read`, { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !body.text) throw new Error(body.error ?? "That didn't go through. Try again, or type it in.");
      setText((t) => (t.trim() ? `${t}\n\n${body.text}` : body.text!));
      say("Here's what I read from the page: it's in the box below. Check it, change anything that's wrong, then press Send. The page itself isn't kept.");
      requestAnimationFrame(() => composer.current?.focus());
    } catch (e) {
      say(e instanceof Error ? e.message : "That didn't go through. Try again, or type it in.");
    } finally {
      setBusy(false);
    }
  }
  const started = useRef(false);
  // The "find things" offer is made once; it comes back only after a look-up, when the story changes again.
  const offered = useRef(false);
  const ro = Boolean(person.example);
  const name = person.preferredName || "them";
  const by = birthYearOf(person);
  const stale = by !== null && person.places.some((pl) => person.researched[researchKey(pl, by)] !== researchInputs(person, pl));
  // New tries alone don't make a gallery (as on the person page): it takes a look-up.
  const hasGallery = Object.entries(person.suggestions).some(([k, cs]) => k !== "new-tries" && cs.length);

  // A new Go-Between message: scroll to its start, so it's read from the top (A9: scrolling to the end of a tall
  // container left a big screen blank). Anything else (your message, a step): just keep the end in view.
  // Braces: scrollIntoView returns a Promise in newer browsers, and an effect may only return a clean-up function.
  // Several at once (what I heard, then a question): the first of them.
  const seen = useRef(msgs.length);
  useEffect(() => {
    const fresh = msgs.slice(Math.min(seen.current, msgs.length));
    seen.current = msgs.length;
    if (!fresh.length) return;
    const first = fresh.find((m) => m.from === "agent");
    const el = first && fresh.at(-1)?.from === "agent" ? document.querySelector<HTMLElement>(`[data-msg="${first.id}"]`) : null;
    // The gallery's button: all of it in view, above the composer (FC-2).
    const opens = [...fresh].reverse().find((m) => "kind" in m && m.kind === "found");
    const button = opens ? document.querySelector<HTMLElement>(`[data-msg="${opens.id}"]`) : null;
    if (button) button.scrollIntoView({ behavior: "smooth", block: "end" });
    else if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs]);
  // On a phone the ideas fold away once the conversation has started, so it gets the screen (A10).
  const [ideas, setIdeas] = useState(false);
  const talked = msgs.some((m) => m.from === "you");
  const cue = Boolean(starter) && !talked && !busy && text.trim().length > 0;
  const hints = missingHints(person);

  // Arriving with ?find=1 (the gallery's "Find more"): look things up straight away.
  useEffect(() => {
    if (!autoFind || ro || started.current || !stale) return;
    const t = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      void find();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on arrival.
  }, []);

  const push = (...m: Msg[]) => setMsgs((xs) => [...xs, ...m]);
  const say = (t: string) => push({ id: id(), from: "agent", text: t });
  // A settled question keeps its answer in its own bubble, so the chat reads in order.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const done = (msgId: string, answer?: string) => {
    setResolved((s) => new Set(s).add(msgId));
    if (answer) setAnswers((a) => ({ ...a, [msgId]: answer }));
  };

  /** Saves the story; returns the saved person (or the old one if it failed). */
  // The latest person and the save in flight: Find things straight after That's right waits for it (a fast tap saw
  // the story before it was saved).
  const latest = useRef(person);
  const saving = useRef<Promise<Person> | null>(null);
  async function save(next: Person): Promise<Person> {
    const run = saveNow(next);
    saving.current = run;
    return run.finally(() => {
      if (saving.current === run) saving.current = null;
    });
  }
  async function saveNow(next: Person): Promise<Person> {
    setPerson(next);
    latest.current = next;
    try {
      const res = await fetch(`/api/people/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(storyPatch(next)) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save.");
      const saved = (await res.json()) as Person;
      setPerson(saved);
      latest.current = saved;
      return saved;
    } catch (e) {
      setPerson(person);
      latest.current = person;
      say(e instanceof Error ? e.message : "That didn't save. Try again.");
      return person;
    }
  }

  /** After something's settled: ask the next thing needed, or offer to find things. */
  function carryOn(p: Person, pendingWidgets = 0, justDone?: string) {
    // Questions answered since they were asked close themselves.
    const settled = (id: string) => resolved.has(id) || id === justDone;
    const open = msgs.filter((m): m is Extract<Msg, { kind: "ask" }> => "kind" in m && m.kind === "ask" && !settled(m.id));
    const answered = open.filter((m) => !stillNeeded(m.ask, p));
    // Questions a later message answered just go: a bubble saying so is noise.
    if (answered.length) setMsgs((ms) => ms.filter((m) => !answered.some((x) => x.id === m.id)));
    if (pendingWidgets > 0) return;
    // What they told me may cover the basics, waiting on a Yes: don't ask again under it (QA-35).
    if (msgs.some((m) => "kind" in m && m.kind === "heard" && !settled(m.id))) return;
    const ask = nextAsk(p);
    const asked = ask && open.some((m) => stillNeeded(m.ask, p) && JSON.stringify(m.ask) === JSON.stringify(ask));
    // Checked against the latest messages too: two answers settling at once both got here and asked twice.
    if (ask && !asked) return setMsgs((ms) => (ms.some((m) => "kind" in m && m.kind === "ask" && !settled(m.id) && JSON.stringify(m.ask) === JSON.stringify(ask)) ? ms : [...ms, { id: id(), from: "agent", kind: "ask", ask }]));
    if (ask) return;
    if (missingMinimum(p).length === 0) {
      const changed = by !== null && p.places.some((pl) => p.researched[researchKey(pl, birthYearOf(p)!)] !== researchInputs(p, pl));
      if ((changed || !hasGallery) && !offered.current) {
        offered.current = true;
        push({ id: id(), from: "agent", kind: "find" });
      }
    }
  }

  async function send() {
    const words = text.trim();
    if (words.length < 3 || busy) return;
    setText("");
    push({ id: id(), from: "you", text: words });
    setBusy(true);
    try {
      const res = await fetch(`/api/people/${person.id}/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: words }) });
      const body = (await res.json()) as { facts?: Candidate[]; followUps?: string[]; error?: string };
      if (!res.ok || !body.facts) throw new Error(body.error ?? "That didn't go through.");
      const plain = body.facts.filter((f) => f.kind !== "painful");
      const painful = body.facts.filter((f) => f.kind === "painful");
      if (!body.facts.length) say(`I couldn't pick anything out of that. A place, a year, or something ${name} loved helps most.`);
      push(
        ...(plain.length ? [{ id: id(), from: "agent" as const, kind: "heard" as const, facts: plain }] : []),
        ...painful.map((fact) => ({ id: id(), from: "agent" as const, kind: "painful" as const, fact })),
        ...(body.followUps?.length ? [{ id: id(), from: "agent" as const, text: body.followUps[0] }] : []),
      );
      if (!plain.length && !painful.length) carryOn(person);
    } catch (e) {
      say(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function find() {
    if (saving.current) await saving.current;
    const person = latest.current;
    if (missingMinimum(person).length) {
      // What they told me may already cover it, waiting on a Yes.
      if (msgs.some((m) => "kind" in m && m.kind === "heard" && !resolved.has(m.id))) {
        say("Tap That’s right on what I heard first, and then I'll look things up.");
        return;
      }
      const ask = nextAsk(person);
      const asked = ask && msgs.some((m) => "kind" in m && m.kind === "ask" && !resolved.has(m.id) && JSON.stringify(m.ask) === JSON.stringify(ask));
      say(`Before I look things up I need ${missingMinimum(person).map((m) => ({ preferredName: "the name they like", birthYear: "roughly when they were born", place: "where they grew up" })[m]).join(" and ")}.`);
      if (ask && !asked) push({ id: id(), from: "agent", kind: "ask", ask });
      return;
    }
    const findingId = id();
    push({ id: findingId, from: "agent", kind: "finding", steps: [] });
    // Each step's line lands in the research message itself, never as a message of its own.
    const research = (f: (steps: Line[]) => Line[]) => setMsgs((ms) => ms.map((m) => ("kind" in m && m.kind === "finding" && m.id === findingId ? { ...m, steps: f(m.steps ?? []) } : m)));
    offered.current = false;
    setBusy(true);
    try {
      const res = await fetch(`/api/people/${person.id}/research`, { method: "POST" });
      if (res.status === 409) {
        push({ id: id(), from: "agent", kind: "found" });
        return;
      }
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "The look-up couldn't start.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let failed: string | null = null;
      const titles = new Map<string, string>();
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RunEvent;
          // Each step says what it added as it lands; the gallery opens only once the whole look-up is done.
          if (event.type === "step-start") {
            titles.set(event.id, event.title);
            research((xs) => [...xs.filter((x) => x.id !== event.id), { id: event.id, text: `${event.running}…`, done: false }]);
          }
          if (event.type === "step-end") {
            const done: Line = { id: event.id, text: addedText(event, titles.get(event.id), person.preferredName), done: true, source: event.sourceLine };
            research((xs) => (xs.some((x) => x.id === event.id) ? xs.map((x) => (x.id === event.id ? done : x)) : [...xs, done]));
          }
          if (event.type === "error") failed = event.message;
        }
      }
      if (failed) say(failed);
      else {
        const fresh = (await (await fetch(`/api/people/${person.id}`)).json()) as Person;
        latest.current = fresh;
        setPerson(fresh);
        push({ id: id(), from: "agent", kind: "found" });
      }
    } catch (e) {
      say(e instanceof Error ? e.message : "The look-up stopped. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  /** Confirms facts from a "here's what I heard" message; what's left unresolved there stays to answer. */
  async function confirmFacts(msgId: string, facts: Candidate[]) {
    let next = person;
    for (const f of facts) next = applyFact(next, f);
    done(msgId);
    const saved = await save(next);
    carryOn(saved, msgs.filter((m) => "kind" in m && m.kind === "painful" && !resolved.has(m.id)).length, msgId);
  }

  async function answerAsk(msgId: string, shown: string, next: Person) {
    done(msgId, shown);
    carryOn(await save(next), 0, msgId);
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4" style={{ "--composer-h": `${composerH + 16}px` } as CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-[30px] leading-[36px]">{hasGallery ? `Tell me more about ${name}` : `${person.preferredName ? `${person.preferredName}’s` : "Their"} story`}</h1>
        <div className="flex gap-2">
          {hasGallery && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/p/${person.id}`}>{name}&apos;s gallery</Link>
            </Button>
          )}
          {/* Always there ("that's enough, go for it"): pressed early, it asks only for what's missing. */}
          {/* Only once there's enough to look up (FC-7): before that, the story comes first. */}
          {!ro && (stale || !hasGallery) && missingMinimum(person).length === 0 && (
            <Button size="sm" onClick={() => void find()} disabled={busy}>
              <Sparkles aria-hidden /> Find things for {name}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3" aria-live="polite">
        {/* A question the story has answered since goes, even before anything else is confirmed (A15). */}
        {/* The same question twice (two answers settling at once both asked it): only the first shows. */}
        {msgs.filter((m, i) => !("kind" in m && m.kind === "ask" && (!stillNeeded(m.ask, person) || msgs.slice(0, i).some((x) => "kind" in x && x.kind === "ask" && !resolved.has(x.id) && JSON.stringify(x.ask) === JSON.stringify(m.ask))))).map((m) =>
          m.from === "you" ? (
            <Message key={m.id} align="end">
              <Bubble align="end">
                <BubbleContent className="text-base whitespace-pre-wrap">{m.text}</BubbleContent>
              </Bubble>
            </Message>
          ) : (
            <Message key={m.id} data-msg={m.id} className="scroll-mt-20 scroll-mb-(--composer-h)">
              <MessageContent className="grid w-full gap-1">
                <span className="flex items-center gap-1.5 text-[15px] font-medium text-muted-foreground">
                  <AgentMark size={20} decorative state={busy && m.id === msgs.at(-1)?.id ? "working" : "rest"} /> Go-Between
                </span>
                <Bubble variant="secondary" className="max-w-full">
                  <BubbleContent className="grid gap-3 text-base">
                    <AgentBody
                      m={m}
                      person={person}
                      name={name}
                      ro={ro}
                      busy={busy}
                      resolved={resolved.has(m.id) || ("kind" in m && m.kind === "ask" && toldSince(m.ask, msgs, msgs.indexOf(m)) !== null)}
                      answer={answers[m.id] ?? ("kind" in m && m.kind === "ask" ? (toldSince(m.ask, msgs, msgs.indexOf(m)) ?? undefined) : undefined)}
                      onHint={(starter) => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${starter}`)}
                      onConfirm={(facts) => void confirmFacts(m.id, facts)}
                      onDrop={() => done(m.id)}
                      onSteer={async (level) => {
                        if (!("fact" in m)) return;
                        done(m.id, level === "never" ? "Never" : level === "sad_ok" ? "Sad but OK" : "No need");
                        const saved = await save(addSteer(person, m.fact.value, level, /^[A-Z]/.test(m.fact.value) && !/^The /.test(m.fact.value) ? "person" : "topic"));
                        carryOn(saved, 0, m.id);
                      }}
                      onAnswer={(shown, next) => void answerAsk(m.id, shown, next)}
                      paused={paused}
                      provenCalm={provenCalm}
                      onHelp={(h) => {
                        push({ id: id(), from: "agent", kind: "help", help: h });
                      }}
                      onFind={() => {
                        done(m.id);
                        void find();
                      }}
                      galleryHref={`/p/${person.id}`}
                    />
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          ),
        )}
        {busy && !msgs.some((m) => "kind" in m && m.kind === "finding" && !resolved.has(m.id)) && (
          <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
            <AgentMark size={20} decorative state="working" /> Go-Between is reading that…
          </p>
        )}
        <div ref={endRef} className="scroll-mb-(--composer-h)" />
      </div>

      {!ro && (
        <div ref={composerBox} className="sticky bottom-0 grid gap-2 border-t bg-background pt-3 pb-4">
          {/* On a phone, once you've started, the ideas sit behind one button (A10). */}
          {talked && hints.length > 0 && (
            <Button size="sm" variant="ghost" className="justify-self-start sm:hidden" aria-expanded={ideas} onClick={() => setIdeas((x) => !x)}>
              <Lightbulb aria-hidden /> {ideas ? "Hide ideas" : "Ideas of what to say"}
            </Button>
          )}
          {/* At most three, for what the story is still missing: they change as it fills in. */}
          {hints.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", talked && !ideas && "max-sm:hidden")} aria-label="What would help">
            {hints.map((h) => (
              <Button key={h.label} size="sm" variant="secondary" className="shrink-0" onClick={() => {
                  setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${h.starter(person.preferredName || "They")}`);
                  // Back to the box, caret at the end, so typing carries on (QA-29).
                  requestAnimationFrame(() => {
                    const el = composer.current;
                    if (!el) return;
                    el.focus();
                    el.setSelectionRange(el.value.length, el.value.length);
                  });
                }}>
                {h.label}
              </Button>
            ))}
          </div>
          )}
          {/* An example's story waits in the box: say plainly what to do next (A11). */}
          {cue && (
            <p className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary" role="status">
              <ArrowDown aria-hidden className="size-4 shrink-0" /> {name}&apos;s story is in the box. Tap Send to read it.
            </p>
          )}
          {/* One box, as in other chat apps: the words on top, attach and talk on the left, Send on the right. */}
          <div className="grid rounded-xl border-2 border-input bg-card focus-within:border-ring">
            <Textarea
              ref={composer}
              aria-label={`Tell the Go-Between about ${name}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Tell me about ${name}. Talk (your phone's dictation), type or paste.`}
              className="max-h-60 min-h-14 resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-4 pt-3 pb-1 text-lg [scrollbar-width:thin] focus-visible:outline-none dark:bg-transparent max-sm:max-h-40"
              maxLength={8000}
            />
            <span className="flex items-center gap-2 px-2 pb-2">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} />
            <Button size="icon" variant="ghost" aria-label="Read a photo or PDF of a “This is me”" title="Read a photo or PDF of a “This is me”" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Paperclip aria-hidden />
            </Button>
            <TalkButton onText={(t) => setText((x) => `${x}${x && !x.endsWith(" ") ? " " : ""}${t}`)} />
            <Button size="icon" aria-label="Send" className={cn("ml-auto", cue && "animate-pulse ring-4 ring-primary/30")} onClick={() => void send()} disabled={busy || text.trim().length < 3}>
              <ArrowUp aria-hidden />
            </Button>
            </span>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">Only what you confirm is kept; the words themselves aren&apos;t.</p>
        </div>
      )}
      {ro && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">
          This is the example, so answering is off.{" "}
          <Link href="/people/new" className="underline underline-offset-4">
            Add your own person
          </Link>{" "}
          to tell their story.
        </p>
      )}
    </div>
  );
}

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const speechApi = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const noop = () => () => {};

/** Talk: the browser's speech recognition, into the text box to check before sending. Hidden where there's none (dictation still works). */
function TalkButton({ onText }: { onText: (t: string) => void }) {
  const supported = useSyncExternalStore(noop, () => speechApi() !== null, () => false);
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  if (!supported) return null;
  function toggle() {
    if (on) return rec.current?.stop();
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim());
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  }
  return (
    <Button size="icon" variant={on ? "destructive" : "ghost"} aria-label={on ? "Stop talking" : "Talk"} aria-pressed={on} onClick={toggle}>
      {on ? <MicOff aria-hidden /> : <Mic aria-hidden />}
    </Button>
  );
}

/** What a research step added, in the Go-Between's words: "Added Paco de Lucía, … to Rosa’s gallery (Sevilla, 1958–1970)." */
export function addedText(event: Extract<RunEvent, { type: "step-end" }>, title: string | undefined, name: string): string {
  const adds = event.id.startsWith("place-") || event.id === "story";
  if (!event.ok || !event.chips.length || !adds) return event.summary;
  const list = event.chips.length > 1 ? `${event.chips.slice(0, -1).join(", ")} and ${event.chips.at(-1)}` : event.chips[0];
  return `Added ${list} to ${possessive(name, true)} gallery${title ? ` (${title})` : ""}.`;
}

/** The chat's first messages: a new person gets the invitation; someone known gets what's known and what would help next. */
function opening(p: Person, paused: Paused[]): Msg[] {
  const name = p.preferredName || "them";
  const known = p.places.length > 0 || p.loves.length > 0;
  if (!known) {
    return [
      { id: "hello", from: "agent", text: `Hello. I'm the Go-Between. Tell me about ${name}, in any order: talk, type, or paste a “This is me” if you have one.` },
      { id: "helps-hint", from: "agent", text: `What helps me most: where ${name} grew up and lived, roughly when they were born, their work, family and big moments, the music, films and shows they loved, and what calms or upsets them. Tap a suggestion below to start, or just tell me. Only what you confirm is kept.` },
    ];
  }
  const by = p.birthYear ? `born ${p.birthYear}` : p.decade ? `born in the ${p.decade}s` : null;
  const places = p.places.map((x) => `${x.name}${x.fromYear || x.toYear ? ` ${yearsText(x.fromYear, x.toYear)}` : ""}`).join(", ");
  return [
    { id: "known", from: "agent", text: `Here's what I know about ${name}: ${[by, places, p.moments.length ? `${p.moments.length} big ${p.moments.length === 1 ? "moment" : "moments"}` : null, p.loves.length ? `${p.loves.length} ${p.loves.length === 1 ? "thing" : "things"} they love` : null, p.steers.length ? `${p.steers.length} ${p.steers.length === 1 ? "thing" : "things"} to steer clear of` : null, p.languages.length ? `grew up speaking ${p.languages.join(", ")}` : null].filter(Boolean).join(" · ")}.` },
    ...(wouldHelpNext(p, paused, 0).length ? [{ id: "helps", from: "agent" as const, kind: "helps" as const }] : []),
  ];
}

/** The question an ask put, for its settled bubble (QA-55). */
function askQuestion(ask: Ask, p: Person, name: string): string {
  const pl = "placeId" in ask ? p.places.find((x) => x.id === ask.placeId)?.name : undefined;
  return {
    name: "The name they like",
    born: `When ${name} was born`,
    place: `Where ${name} grew up`,
    from: `When ${name} moved to ${pl ?? "there"}`,
    to: `Until when ${name} was in ${pl ?? "there"}`,
    steer: "Anything to steer clear of",
    language: "The language they grew up speaking",
  }[ask.kind];
}

/** "brother Tom" mid-sentence; names and "The war" keep their capital. */
const midSentence = (label: string) =>
  label.replace(/^(Brother|Sister|Mother|Father|Mum|Dad|Son|Daughter|Husband|Wife|Uncle|Aunt|Auntie|Cousin|Grandson|Granddaughter|Hermano|Hermana|Madre|Padre|Hijo|Hija|Marido|Esposo|Esposa|Tío|Tía|Primo|Prima) /, (w) => w.toLowerCase());

function steerNote(label: string, answer?: string): string {
  if (answer === "Never") return `I'll steer clear of ${midSentence(label)}.`;
  if (answer === "Sad but OK") return `Noted: ${midSentence(label)} is sad but OK to mention.`;
  return `Noted: no need to steer clear of ${midSentence(label)}.`;
}

/** A question once answered: the answer in place (or that a later message answered it). */
function Settled({ question, answer }: { question?: string; answer?: string }) {
  return (
    <span className="grid gap-0.5">
      {question && <span className="text-sm text-foreground/70">{question}</span>}
      {answer ? (
        <span className="flex items-center gap-1.5">
          <Check aria-hidden className="size-4 text-emerald-600" /> {answer}
        </span>
      ) : (
        <span className="text-foreground/70">Thanks.</span>
      )}
    </span>
  );
}

type BodyProps = {
  m: Extract<Msg, { from: "agent" }>;
  person: Person;
  name: string;
  ro: boolean;
  busy: boolean;
  resolved: boolean;
  /** What was answered, shown in the settled question. */
  answer?: string;
  onHint: (starter: string) => void;
  onConfirm: (facts: Candidate[]) => void;
  onDrop: () => void;
  onSteer: (level: "never" | "sad_ok" | "no_need") => void;
  onAnswer: (shown: string, next: Person) => void;
  onHelp: (h: Help) => void;
  onFind: () => void;
  galleryHref: string;
  paused: Paused[];
  provenCalm: number;
};

function AgentBody(props: BodyProps) {
  const { m, person, name, ro, resolved } = props;
  if (!("kind" in m)) return <span className="whitespace-pre-wrap">{m.text}</span>;
  switch (m.kind) {
    case "heard":
      return <Heard facts={m.facts} resolved={resolved} ro={ro} onConfirm={props.onConfirm} onDrop={props.onDrop} />;
    case "painful":
      return resolved ? <span>{steerNote(m.fact.value, props.answer)}</span> : <SteerQuestion question={`You mentioned ${midSentence(m.fact.value)}. Shall I steer clear of that in what I suggest?`} onAnswer={props.onSteer} />;
    case "ask":
      return resolved ? <Settled question={askQuestion(m.ask, person, name)} answer={props.answer} /> : <AskInput ask={m.ask} person={person} name={name} onAnswer={props.onAnswer} />;
    case "helps":
      return <HelpChips person={person} name={name} onHelp={props.onHelp} ro={ro} paused={props.paused} provenCalm={props.provenCalm} />;
    case "help":
      return resolved ? <Settled question={m.help.label} answer={props.answer} /> : <HelpInput help={m.help} person={person} onSave={(p, shown) => props.onAnswer(shown, p)} />;
    case "find":
      return resolved ? (
        <span>Looking things up for {name}.</span>
      ) : (
        <span className="grid gap-2">
          <span>I know enough to find songs, films, TV and places for {name}&apos;s years and places. Keep telling me if you like; the more I know, the better I dig.</span>
          <span>
            <Button size="sm" onClick={props.onFind} disabled={props.busy || ro}>
              <Sparkles aria-hidden /> Find things for {name}
            </Button>
          </span>
        </span>
      );
    case "finding":
      return (
        <span className="grid gap-3">
          <span>Looking through {person.places.map((p) => p.name).join(" and ")} for the years {name} was young.</span>
          {/* The research as it goes: what it's looking up, then what that added. No spinners or ticks: the Go-Between's mark shows it's working. */}
          {(m.steps?.length ?? 0) > 0 && (
            <ol className="grid gap-2 border-l-2 border-border pl-3" aria-label="Research" aria-live="polite">
              {m.steps!.map((x) => (
                <li key={x.id} className="grid gap-0.5">
                  <span className={cn(!x.done && "text-muted-foreground")}>{x.text}</span>
                  {x.source && <span className="text-xs text-muted-foreground">{x.source}</span>}
                </li>
              ))}
            </ol>
          )}
        </span>
      );
    case "found":
      return (
        <span className="grid gap-2">
          <span>Done. {name}&apos;s gallery is ready: things to play and talk about. Come back here any time to tell me more.</span>
          <span>
            <Button asChild size="sm">
              <Link href={props.galleryHref}>Open {name}&apos;s gallery</Link>
            </Button>
          </span>
        </span>
      );
  }
}

/** "Here's what I heard": That's right for the lot, and a Change per fact (UX-5, R2-3). */
function Heard({ facts, resolved, ro, onConfirm, onDrop }: { facts: Candidate[]; resolved: boolean; ro: boolean; onConfirm: (f: Candidate[]) => void; onDrop: () => void }) {
  // Kept unless changed (UX-5): one "That's right" for the lot, and a quiet Change per fact (Remove is inside it).
  const [list, setList] = useState(facts);
  const [editing, setEditing] = useState<string | null>(null);
  const [kept, setKept] = useState<Candidate[]>([]);
  // A long story: the first six, and how many more (R2-7).
  if (resolved) return <span>Got it: {kept.length ? `${kept.slice(0, 6).map(describeFact).join(" · ")}${kept.length > 6 ? ` · and ${kept.length - 6} more` : ""}` : "nothing kept from that"}.</span>;
  const finish = (k: Candidate[]) => {
    setKept(k);
    setList([]);
    if (k.length) onConfirm(k);
    else onDrop();
  };
  const right = (label: string, variant: "default" | "outline" = "default") => (
    <Button size="sm" variant={variant} className="max-sm:h-11" disabled={editing !== null} onClick={() => finish(list)}>
      <Check aria-hidden /> {label}
    </Button>
  );
  return (
    <span className="grid gap-2">
      <span className="flex flex-wrap items-center justify-between gap-2 max-sm:sticky max-sm:top-2 max-sm:z-10 max-sm:rounded-md max-sm:bg-secondary max-sm:py-1">
        <span className="font-medium">Here&apos;s what I heard:</span>
        {!ro && right("That’s right")}
      </span>
      {list.map((f) => (
        <span key={f.id} className="grid gap-1 rounded-md border bg-background p-2 text-foreground">
          {editing === f.id ? (
            <EditFact
              fact={f}
              onDone={(n) => (setEditing(null), setList((xs) => xs.map((x) => (x.id === f.id ? { ...x, ...n } : x))))}
              onRemove={() => {
                setEditing(null);
                const rest = list.filter((x) => x.id !== f.id);
                setList(rest);
                if (!rest.length) finish([]);
              }}
            />
          ) : (
            <span className="flex items-start justify-between gap-2">
              <span className="grid gap-0.5">
                <span className="font-medium">{describeFact(f)}</span>
                {f.quote && <span className="text-xs text-muted-foreground">“{f.quote}”</span>}
              </span>
              {!ro && (
                <Button size="sm" variant="ghost" className="min-h-11 shrink-0" aria-label={`Change: ${describeFact(f)}`} onClick={() => setEditing(f.id)}>
                  <Pencil aria-hidden /> Change
                </Button>
              )}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function EditFact({ fact, onDone, onRemove }: { fact: Candidate; onDone: (f: Partial<Fact>) => void; onRemove: () => void }) {
  const [value, setValue] = useState(fact.value);
  const [from, setFrom] = useState(fact.fromYear ? String(fact.fromYear) : "");
  const [to, setTo] = useState(fact.toYear ? String(fact.toYear) : "");
  const yr = (s: string) => (/^\d{4}$/.test(s) ? Number(s) : null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Input aria-label="What it is" value={value} onChange={(e) => setValue(e.target.value)} className="h-11 w-56" />
      {["place", "moment", "birthYear", "love"].includes(fact.kind) && <Input aria-label="Year" inputMode="numeric" placeholder="year" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-11 w-24" />}
      {fact.kind === "place" && <Input aria-label="Until" inputMode="numeric" placeholder="until" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-11 w-24" />}
      <Button className="h-11" onClick={() => onDone({ value: value.trim() || fact.value, fromYear: yr(from), toYear: yr(to) })}>
        Done
      </Button>
      <Button variant="ghost" className="h-11" onClick={onRemove}>
        <X aria-hidden /> Remove
      </Button>
    </span>
  );
}

/** One question, with the input that fits it. */
function AskInput({ ask, person, name, onAnswer }: { ask: Ask; person: Person; name: string; onAnswer: (shown: string, next: Person) => void }) {
  switch (ask.kind) {
    case "name":
      return <TextInput id="a-name" label="What name do they like to be called?" onSave={(v) => onAnswer(v, { ...person, preferredName: v.slice(0, 40) })} />;
    case "born":
      return (
        <YearInput
          id="a-born"
          label={`Roughly when was ${name} born? A decade is fine.`}
          value={null}
          min={1915}
          max={1995}
          choices={[1930, 1940, 1950, 1960].map((d) => ({ label: `${d}s`, value: d, choice: "decade" }))}
          onSave={(y, choice) => y && onAnswer(choice === "decade" ? `The ${y}s` : String(y), choice === "decade" ? { ...person, decade: y } : { ...person, birthYear: y })}
        />
      );
    case "place":
      return <PlaceSearch id="a-place" label={`Where did ${name} grow up?`} onPick={(pl) => onAnswer(pl.label ?? pl.name, addPlace(person, { name: pl.name, label: pl.label, fromYear: birthYearOf(person), toYear: null, role: "grew up" }))} />;
    case "from":
    case "to": {
      const pl = person.places.find((x) => x.id === ask.placeId)!;
      const field = ask.kind === "from" ? "fromYear" : "toYear";
      return (
        <YearInput
          id={`a-${ask.kind}-${pl.id}`}
          label={ask.kind === "from" ? `When did ${name} move to ${pl.name}?` : `Until when was ${name} in ${pl.name}?`}
          value={null}
          choices={[{ label: "Not sure", value: null }]}
          onSave={(y) => onAnswer(y ? String(y) : "Not sure", { ...person, places: person.places.map((x) => (x.id === pl.id ? (y ? { ...x, [field]: y } : { ...x, yearsUnknown: true }) : x)) })}
        />
      );
    }
    case "steer":
      return <SteerTopic person={person} name={name} onSave={(p, shown) => onAnswer(shown, p)} />;
    case "language":
      return <LanguageAsk name={name} onSave={(lang) => onAnswer(lang, { ...person, languages: [lang] })} />;
  }
}

const LANGUAGES = ["English", "Welsh", "Gaelic", "Spanish", "Punjabi", "Urdu", "Polish", "Jamaican Patois"];

function LanguageAsk({ name, onSave }: { name: string; onSave: (lang: string) => void }) {
  const [other, setOther] = useState("");
  return (
    <span className="grid gap-2">
      <span>What language did {name} grow up speaking? Some people return to it, and a few words in it can help.</span>
      <span className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((l) => (
          <Button key={l} size="sm" variant="outline" onClick={() => onSave(l)}>
            {l}
          </Button>
        ))}
      </span>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (other.trim().length >= 2) onSave(other.trim().slice(0, 30));
        }}
      >
        <Input aria-label="Another language" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Another language" className="h-11 sm:w-56" maxLength={30} />
        <Button size="sm" type="submit" disabled={other.trim().length < 2}>
          Save
        </Button>
      </form>
    </span>
  );
}

function SteerTopic({ person, name, onSave }: { person: Person; name: string; onSave: (p: Person, shown: string) => void }) {
  const [label, setLabel] = useState("");
  return (
    <span className="grid gap-2">
      <span>Is there anything I should steer clear of for {name}? A person, a topic, a sound. Just a short label; no reason needed.</span>
      {/* One clear "nothing"; Never and Sad but OK only once there's a label to answer for (FC-14). */}
      <span className="flex flex-wrap items-center gap-2">
        <Input aria-label="Something to steer clear of" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The war, loud bangs" className="h-11 min-w-0 basis-full sm:basis-72" maxLength={60} />
        {label.trim().length >= 2 ? (
          <>
            <Button className="h-11" onClick={() => onSave(addSteer(person, label, "never"), `Steer clear of ${label.trim()}`)}>
              Never
            </Button>
            <Button variant="outline" className="h-11" onClick={() => onSave(addSteer(person, label, "sad_ok"), `${label.trim()}: sad but OK`)}>
              Sad but OK
            </Button>
          </>
        ) : (
          <Button variant="outline" className="h-11" onClick={() => onSave({ ...person, steerAsked: true }, "Nothing to steer clear of")}>
            Nothing to steer clear of
          </Button>
        )}
      </span>
    </span>
  );
}

/** What would help next, as chips: tapping one asks its question in the chat. */
function HelpChips({ person, name, onHelp, ro, paused, provenCalm }: { person: Person; name: string; onHelp: (h: Help) => void; ro: boolean; paused: Paused[]; provenCalm: number }) {
  const helps = wouldHelpNext(person, paused, provenCalm);
  return (
    <span className="grid gap-2">
      <span>What would help me most next for {name}:</span>
      <span className="flex flex-wrap gap-1.5">
        {helps.map((h) => (
          <Button key={h.id} size="xs" variant="outline" disabled={ro} onClick={() => onHelp(h)} className="h-auto min-h-8 max-w-full py-1 text-left whitespace-normal">
            {/* An upset to ask about says so with an icon, not red (UX-6). */}
            {h.kind === "upset" && <Ban aria-hidden />}
            {h.label}
          </Button>
        ))}
      </span>
      {!ro && <span className="text-foreground/70">Or just tell me more below.</span>}
    </span>
  );
}

/** The typed input behind a "would help next" chip. */
function HelpInput({ help, person, onSave }: { help: Help; person: Person; onSave: (p: Person, shown: string) => void }) {
  const name = person.preferredName || "they";
  switch (help.kind) {
    case "upset":
      return (
        <span className="grid gap-2">
          <span>
            {help.tearful ? `${name} was tearful during ‘${help.itemTitle}’. Tears can be part of a good moment: keep it, or steer clear?` : `${name} was upset during ‘${help.itemTitle}’. Shall I steer clear of it?`}
          </span>
          {/* Buttons that answer the question asked, all alike: none is the "right" answer (FC-6). */}
          <span className="flex flex-wrap gap-2">
            {(help.tearful
              ? ([["Keep it", false], ["Steer clear", true]] as const)
              : ([["Steer clear", true], ["Sad but OK", false], ["A one-off", false]] as const)
            ).map(([label, steer]) => (
              <Button key={label} size="sm" variant="outline" className="max-sm:h-11" onClick={() => onSave(steer ? addSteer(person, help.itemTitle, "never", "item", "logged") : { ...person, resolvedUpsets: [...person.resolvedUpsets, help.itemKey] }, label)}>
                {label}
              </Button>
            ))}
          </span>
        </span>
      );
    case "steer":
      return <SteerTopic person={person} name={name} onSave={onSave} />;
    case "place":
      return <PlaceSearch id="h-place" label={help.label} onPick={(pl) => onSave(addPlace(person, { name: pl.name, label: pl.label, fromYear: person.places.at(-1)?.toYear ?? null, toYear: null, role: "lived" }), pl.label ?? pl.name)} />;
    case "moment":
      return (
        <TextInput
          id="h-moment"
          label="A wedding, dancing, a move: what and when?"
          placeholder="e.g. Married at St Mary's in 1972"
          onSave={(t) => {
            const year = t.match(/(19|20)\d\d/)?.[0];
            const kind = /marri|wedd/i.test(t) ? "wedding" : /danc/i.test(t) ? "dance" : /mov/i.test(t) ? "move" : /servic|army|navy|raf/i.test(t) ? "service" : "other";
            onSave({ ...person, moments: [...person.moments, { id: uid("mo"), kind, year: year ? Number(year) : null, label: t }] }, t);
          }}
        />
      );
    case "calms":
      return <TextInput id="h-calms" label={`What calms ${name}?`} placeholder="e.g. Dusty, softly; holding a hand" onSave={(t) => onSave({ ...person, practical: { ...person.practical, calms: t } }, t)} />;
    case "work":
      return <TextInput id="h-work" label="Their work, trade or skills?" placeholder="e.g. A shop on Market Street; sewing" onSave={(t) => onSave({ ...person, practical: { ...person.practical, work: t } }, t)} />;
    case "faith":
      return (
        <span className="grid gap-2">
          <TextInput id="h-faith" label="Faith in what I suggest: which (hymns, festivals)?" onSave={(t) => onSave({ ...person, practical: { ...person.practical, faith: { stance: "yes", label: t.slice(0, 60) } } }, t)} />
          <span>
            <Button size="xs" variant="outline" onClick={() => onSave({ ...person, practical: { ...person.practical, faith: { stance: "keep_out" } } }, "Keep faith out")}>
              Keep it out
            </Button>
          </span>
        </span>
      );
    case "hearing":
      return (
        <span className="grid gap-2">
          <TextInput id="h-hearing" label="Hearing?" placeholder="e.g. Hears better on the left" onSave={(t) => onSave({ ...person, practical: { ...person.practical, hearing: t } }, t)} />
          <span className="flex flex-wrap items-center gap-2">
            Headphones:
            <Button size="xs" variant="outline" onClick={() => onSave({ ...person, practical: { ...person.practical, headphonesOk: true } }, "Headphones are fine")}>
              Fine
            </Button>
            <Button size="xs" variant="outline" onClick={() => onSave({ ...person, practical: { ...person.practical, headphonesOk: false } }, "No headphones")}>
              No headphones
            </Button>
          </span>
        </span>
      );
    case "heard": {
      const h = person.staffHeard.find((x) => x.id === help.heardId);
      if (!h) return null;
      return (
        <span className="grid gap-2">
          <span>Someone caring for {name} heard: “{h.text}”. Is that right?</span>
          <span className="flex flex-wrap gap-2">
            <Button size="xs" onClick={() => onSave({ ...person, staffHeard: person.staffHeard.map((x) => (x.id === h.id ? { ...x, confirmed: true } : x)) }, "Yes, that's right")}>
              Yes
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onSave({ ...person, staffHeard: person.staffHeard.filter((x) => x.id !== h.id) }, "Not right")}>
              Not right
            </Button>
          </span>
        </span>
      );
    }
  }
}

