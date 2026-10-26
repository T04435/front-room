"use client";

import { ArrowUp, Check, Mic, MicOff, Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyStepEvent, RunSteps, type StepItem } from "@/components/run-steps";
import { PlaceSearch, SteerQuestion, TextInput, YearInput } from "@/components/story-inputs";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message, MessageContent } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { birthYearOf, missingMinimum, researchInputs, researchKey, type Fact, type Person } from "@/lib/person";
import type { FamilyQuestion } from "@/lib/learning";
import type { RunEvent } from "@/lib/run-events";
import { addPlace, addSteer, applyFact, describeFact, storyPatch, uid, wouldHelpNext, type Help } from "@/lib/story";

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
  | { id: string; from: "agent"; kind: "finding" }
  | { id: string; from: "agent"; kind: "found" };

/** What helps, from the Alzheimer's Society's "This is me": each adds a starter line to the box. */
const HINTS: { label: string; starter: (n: string) => string }[] = [
  { label: "Where they grew up", starter: (n) => `${n} grew up in ` },
  { label: "Where they lived after", starter: () => "Later they lived in " },
  { label: "Their work", starter: (n) => `${n} worked as ` },
  { label: "Family and big moments", starter: () => "A big moment was " },
  { label: "Faith", starter: () => "Faith: " },
  { label: "Music, films and shows", starter: (n) => `${n} loved ` },
  // Their own songs beat era picks (Playlist for Life asks these first).
  { label: "A song they always sang", starter: (n) => `${n} always sang ` },
  { label: "Their wedding music", starter: () => "At their wedding they danced to " },
  { label: "What calms them", starter: () => "What calms them is " },
  { label: "What upsets them", starter: () => "Please steer clear of " },
];

const id = () => Math.random().toString(36).slice(2, 10);

/** The next single thing to ask for, most needed first: the minimum, then years at each place, then steer-clear. */
function nextAsk(p: Person): Ask | null {
  if (!p.preferredName.trim()) return { kind: "name" };
  if (birthYearOf(p) === null) return { kind: "born" };
  if (!p.places.length) return { kind: "place" };
  const noFrom = p.places.find((x, i) => x.fromYear === null && i > 0 && !x.yearsUnknown);
  if (noFrom) return { kind: "from", placeId: noFrom.id };
  const noTo = p.places.find((x, i) => x.toYear === null && i < p.places.length - 1 && !x.yearsUnknown);
  if (noTo) return { kind: "to", placeId: noTo.id };
  if (!p.steerAsked && !p.steers.length) return { kind: "steer" };
  // The language they grew up speaking: some return to it, and a few words in it can reach them (PR-10).
  if (!p.languages.length) return { kind: "language" };
  return null;
}

/** Whether an ask is still open for this person (it may have been answered in a story told since). */
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
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    ...opening(initial, paused),
    ...(starter ? [{ id: "example", from: "agent" as const, text: `This is a fictional example: ${initial.preferredName}'s “This is me” is in the box below. Edit it if you like, then press Send.` }] : []),
  ]);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  // The "find things" offer is made once; it comes back only after a look-up, when the story changes again.
  const offered = useRef(false);
  const ro = Boolean(person.example);
  const name = person.preferredName || "them";
  const by = birthYearOf(person);
  const stale = by !== null && person.places.some((pl) => person.researched[researchKey(pl, by)] !== researchInputs(person, pl));
  // New tries alone don't make a gallery (as on the person page): it takes a look-up.
  const hasGallery = Object.entries(person.suggestions).some(([k, cs]) => k !== "new-tries" && cs.length);

  // Braces: scrollIntoView returns a Promise in newer browsers, and an effect may only return a clean-up function.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length, steps.length]);

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
  async function save(next: Person): Promise<Person> {
    setPerson(next);
    try {
      const res = await fetch(`/api/people/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(storyPatch(next)) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save.");
      const saved = (await res.json()) as Person;
      setPerson(saved);
      return saved;
    } catch (e) {
      setPerson(person);
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
    if (ask && !asked) return push({ id: id(), from: "agent", kind: "ask", ask });
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
    if (missingMinimum(person).length) {
      // What they told me may already cover it, waiting on a Yes.
      if (msgs.some((m) => "kind" in m && m.kind === "heard" && !resolved.has(m.id))) {
        say("Tap Yes or All right on what I heard first, and then I'll look things up.");
        return;
      }
      const ask = nextAsk(person);
      const asked = ask && msgs.some((m) => "kind" in m && m.kind === "ask" && !resolved.has(m.id) && JSON.stringify(m.ask) === JSON.stringify(ask));
      say(`Before I look things up I need ${missingMinimum(person).map((m) => ({ preferredName: "the name they like", birthYear: "roughly when they were born", place: "where they grew up" })[m]).join(" and ")}.`);
      if (ask && !asked) push({ id: id(), from: "agent", kind: "ask", ask });
      return;
    }
    push({ id: id(), from: "agent", kind: "finding" });
    offered.current = false;
    setBusy(true);
    setSteps([]);
    try {
      const res = await fetch(`/api/people/${person.id}/research`, { method: "POST" });
      if (res.status === 409) {
        push({ id: id(), from: "agent", kind: "found" });
        return;
      }
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "The look-up couldn't start.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let n = 0;
      let failed: string | null = null;
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RunEvent;
          setSteps((xs) => applyStepEvent(xs, event, n++));
          if (event.type === "error") failed = event.message;
        }
      }
      if (failed) say(failed);
      else {
        setPerson((await (await fetch(`/api/people/${person.id}`)).json()) as Person);
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
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{hasGallery ? `Get to know ${name} better` : `${person.preferredName ? `${person.preferredName}’s` : "Their"} story`}</h1>
        <div className="flex gap-2">
          {hasGallery && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/p/${person.id}`}>{name}&apos;s gallery</Link>
            </Button>
          )}
          {/* Always there ("that's enough, go for it"): pressed early, it asks only for what's missing. */}
          {!ro && (stale || !hasGallery) && (
            <Button size="sm" onClick={() => void find()} disabled={busy}>
              <Sparkles aria-hidden /> Find things for {name}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3" aria-live="polite">
        {msgs.map((m) =>
          m.from === "you" ? (
            <Message key={m.id} align="end">
              <Bubble align="end">
                <BubbleContent className="text-base whitespace-pre-wrap">{m.text}</BubbleContent>
              </Bubble>
            </Message>
          ) : (
            <Message key={m.id}>
              <MessageContent className="grid w-full gap-1">
                <span className="text-xs font-medium text-muted-foreground">Go-Between</span>
                <Bubble variant="secondary" className="max-w-full">
                  <BubbleContent className="grid gap-3 text-base">
                    <AgentBody
                      m={m}
                      person={person}
                      name={name}
                      ro={ro}
                      busy={busy}
                      resolved={resolved.has(m.id)}
                      answer={answers[m.id]}
                      steps={steps}
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
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> The Go-Between is reading that…
          </p>
        )}
        <div ref={endRef} className="scroll-mb-56" />
      </div>

      {!ro && (
        <div className="sticky bottom-0 grid gap-2 border-t bg-background pt-3 pb-4">
          {/* One scrolling row on a phone, so the chat keeps the screen. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" aria-label="What helps">
            {HINTS.map((h) => (
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
          <div className="flex items-end gap-2">
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
              className="max-h-48 min-h-14"
              maxLength={8000}
            />
            <TalkButton onText={(t) => setText((x) => `${x}${x && !x.endsWith(" ") ? " " : ""}${t}`)} />
            <Button size="icon" aria-label="Send" onClick={() => void send()} disabled={busy || text.trim().length < 3}>
              <ArrowUp aria-hidden />
            </Button>
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
    <Button size="icon" variant={on ? "destructive" : "outline"} aria-label={on ? "Stop talking" : "Talk"} aria-pressed={on} onClick={toggle}>
      {on ? <MicOff aria-hidden /> : <Mic aria-hidden />}
    </Button>
  );
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
  const places = p.places.map((x) => `${x.name}${x.fromYear ? ` ${x.fromYear}–${x.toYear ?? ""}` : ""}`).join(", ");
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
  steps: StepItem[];
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
        <span className="grid gap-2">
          <span>Looking through {person.places.map((p) => p.name).join(" and ")} for the years {name} was young.</span>
          {props.steps.length > 0 && <RunSteps items={props.steps} />}
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

/** "Here's what I heard": each fact with Yes, Edit or Remove, and All right for the lot. */
function Heard({ facts, resolved, ro, onConfirm, onDrop }: { facts: Candidate[]; resolved: boolean; ro: boolean; onConfirm: (f: Candidate[]) => void; onDrop: () => void }) {
  const [list, setList] = useState(facts);
  const [editing, setEditing] = useState<string | null>(null);
  const [kept, setKept] = useState<Candidate[]>([]);
  if (resolved) return <span>Got it: {kept.length ? kept.map(describeFact).join(" · ") : "nothing kept from that"}.</span>;
  const finish = (k: Candidate[]) => {
    setKept(k);
    setList([]);
    if (k.length) onConfirm(k);
    else onDrop();
  };
  return (
    <span className="grid gap-2">
      <span className="font-medium">Here&apos;s what I heard:</span>
      {list.map((f) => (
        <span key={f.id} className="grid gap-1 rounded-md border bg-background p-2 text-foreground">
          {editing === f.id ? (
            <EditFact fact={f} onDone={(n) => (setEditing(null), setList((xs) => xs.map((x) => (x.id === f.id ? { ...x, ...n } : x))))} />
          ) : (
            <span className="font-medium">{describeFact(f)}</span>
          )}
          {f.quote && <span className="text-xs text-muted-foreground">“{f.quote}”</span>}
          {editing !== f.id && !ro && (
            <span className="flex flex-wrap gap-1.5">
              <Button
                size="xs"
                onClick={() => {
                  const k = [...kept, f];
                  const rest = list.filter((x) => x.id !== f.id);
                  setKept(k);
                  setList(rest);
                  if (!rest.length) finish(k);
                }}
              >
                <Check aria-hidden /> Yes
              </Button>
              <Button size="xs" variant="outline" onClick={() => setEditing(f.id)}>
                <Pencil aria-hidden /> Edit
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  const rest = list.filter((x) => x.id !== f.id);
                  setList(rest);
                  if (!rest.length) finish(kept);
                }}
              >
                <X aria-hidden /> Remove
              </Button>
            </span>
          )}
        </span>
      ))}
      {list.length > 1 && !ro && (
        <span>
          <Button size="sm" onClick={() => finish([...kept, ...list])}>
            <Check aria-hidden /> All right
          </Button>
        </span>
      )}
    </span>
  );
}

function EditFact({ fact, onDone }: { fact: Candidate; onDone: (f: Partial<Fact>) => void }) {
  const [value, setValue] = useState(fact.value);
  const [from, setFrom] = useState(fact.fromYear ? String(fact.fromYear) : "");
  const [to, setTo] = useState(fact.toYear ? String(fact.toYear) : "");
  const yr = (s: string) => (/^\d{4}$/.test(s) ? Number(s) : null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Input aria-label="What it is" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-56" />
      {["place", "moment", "birthYear", "love"].includes(fact.kind) && <Input aria-label="Year" inputMode="numeric" placeholder="year" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-8 w-20" />}
      {fact.kind === "place" && <Input aria-label="Until" inputMode="numeric" placeholder="until" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-8 w-20" />}
      <Button size="xs" onClick={() => onDone({ value: value.trim() || fact.value, fromYear: yr(from), toYear: yr(to) })}>
        Done
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

const LANGUAGES = ["English", "Welsh", "Gaelic", "Punjabi", "Urdu", "Polish", "Jamaican Patois"];

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
        <Input aria-label="Another language" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Another language" className="h-8 sm:w-56" maxLength={30} />
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
      <span className="flex flex-wrap gap-2">
        <Input aria-label="Something to steer clear of" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The war, loud bangs" className="h-8 sm:w-64" maxLength={60} />
        <Button size="xs" disabled={label.trim().length < 2} onClick={() => onSave(addSteer(person, label, "never"), `Steer clear of ${label.trim()}`)}>
          Never
        </Button>
        <Button size="xs" variant="outline" disabled={label.trim().length < 2} onClick={() => onSave(addSteer(person, label, "sad_ok"), `${label.trim()}: sad but OK`)}>
          Sad but OK
        </Button>
        <Button size="xs" variant="ghost" onClick={() => onSave({ ...person, steerAsked: true }, "Nothing to steer clear of")}>
          Nothing
        </Button>
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
          <Button key={h.id} size="xs" variant={h.kind === "upset" ? "destructive" : "outline"} disabled={ro} onClick={() => onHelp(h)}>
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
            {help.tearful ? `${name} was tearful during ${help.itemTitle}. Tears can be part of a good moment: keep it, or steer clear?` : `${name} was upset during ${help.itemTitle}. Shall I steer clear of it?`}
          </span>
          <span className="flex flex-wrap gap-2">
            <Button size="xs" onClick={() => onSave(addSteer(person, help.itemTitle, "never", "item", "logged"), "Never")}>
              Never
            </Button>
            <Button size="xs" variant="outline" onClick={() => onSave({ ...person, resolvedUpsets: [...person.resolvedUpsets, help.itemKey] }, "Sad but OK")}>
              Sad but OK
            </Button>
            {!help.tearful && (
              <Button size="xs" variant="outline" onClick={() => onSave({ ...person, resolvedUpsets: [...person.resolvedUpsets, help.itemKey] }, "A one-off")}>
                A one-off
              </Button>
            )}
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

