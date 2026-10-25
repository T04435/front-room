"use client";

import { ArrowRight, Check, CircleAlert, MessageSquareText, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlaceSearch, SteerQuestion, TextInput, YearInput } from "@/components/story-inputs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { birthYearOf, missingMinimum, type Fact, type Person } from "@/lib/person";
import { addPlace, addSteer, applyFact, describeFact, placesWithoutYears, storyPatch, uid, wouldHelpNext, type Help } from "@/lib/story";

type Candidate = Fact & { id: string };
type Paused = { key: string; title: string; lastUpsetAt: string | null };

/** "This is me" themes as hint chips: each adds a starter line to the box. */
const HINTS: { label: string; starter: (n: string) => string }[] = [
  { label: "grew up", starter: (n) => `${n} grew up in ` },
  { label: "lived after", starter: () => "Later they lived in " },
  { label: "work", starter: (n) => `${n} worked as ` },
  { label: "family and big moments", starter: () => "A big moment was " },
  { label: "faith", starter: () => "Faith: " },
  { label: "music, films and shows", starter: (n) => `${n} loved ` },
  { label: "what calms them", starter: () => "What calms them is " },
  { label: "what upsets them", starter: () => "Please steer clear of " },
];

const KIND_LABEL: Partial<Record<Fact["kind"], string>> = { place: "Place", moment: "Moment", love: "Love", birthYear: "Born", decade: "Born", preferredName: "Name" };

/**
 * The story chat (v2 brief, P0 2 and 3): talk, type or paste, in any order; "here's what I heard" cards to confirm (only
 * confirmed facts are saved; the text is thrown away); missing details as typed inputs; painful mentions as a
 * steer-clear question. Coming back, it opens with what's known and what would help next. "That's enough, go for it"
 * is always there. No Qloo calls here, except the place search.
 */
export function StoryChat({ initial, paused, provenCalm }: { initial: Person; paused: Paused[]; provenCalm: number }) {
  const router = useRouter();
  const [person, setPerson] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Candidate[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [goPressed, setGoPressed] = useState(false);
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const ro = Boolean(person.example);
  const name = person.preferredName || "them";
  const returning = initial.places.length > 0 || initial.loves.length > 0;
  const missing = missingMinimum(person);

  /** Saves a change to the story (optimistic; reverted on failure). */
  async function save(next: Person) {
    const before = person;
    setPerson(next);
    try {
      const res = await fetch(`/api/people/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(storyPatch(next)) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save.");
      setPerson((await res.json()) as Person);
    } catch (e) {
      setPerson(before);
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
    }
  }

  async function send() {
    if (text.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${person.id}/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = (await res.json()) as { facts?: Candidate[]; error?: string };
      if (!res.ok || !body.facts) throw new Error(body.error ?? "That didn't go through.");
      setCards((c) => [...c, ...body.facts!]);
      // The words themselves aren't kept: only the facts confirmed from them.
      setText("");
      if (!body.facts.length) setError("Nothing to add from that. Try a place, a year, or something they loved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const drop = (id: string) => setCards((c) => c.filter((x) => x.id !== id));
  async function confirm(c: Candidate) {
    drop(c.id);
    await save(applyFact(person, c));
  }
  async function confirmAll() {
    const ok = cards.filter((c) => c.kind !== "painful");
    let next = person;
    for (const c of ok) next = applyFact(next, c);
    setCards((cs) => cs.filter((c) => c.kind === "painful"));
    await save(next);
  }

  function go() {
    if (missing.length) {
      setGoPressed(true);
      document.getElementById("missing")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    router.push(`/p/${person.id}/bell`);
  }

  const helps = wouldHelpNext(person, paused, provenCalm);
  const noYears = placesWithoutYears(person);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold">{person.preferredName ? `${person.preferredName}’s story` : "Their story"}</h1>
          <p className="text-sm text-muted-foreground">{returning ? "Pick up where you left off, or just tell us more." : "Tell us about them, in any order. Talk, type or paste."}</p>
        </div>
        {!ro && (
          <Button onClick={go}>
            That&apos;s enough, go for it <ArrowRight aria-hidden />
          </Button>
        )}
      </div>

      {ro && (
        <Alert>
          <AlertDescription>The example is read-only. Try your own person to tell a story.</AlertDescription>
        </Alert>
      )}

      {returning && <Known person={person} onSave={save} ro={ro} />}

      {!ro && returning && helps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Would help next</CardTitle>
            <CardDescription>Tap one, or just keep telling stories below.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {helps.map((h) => (
                <Button key={h.id} size="sm" variant={openHelp === h.id ? "default" : h.kind === "upset" ? "destructive" : "outline"} onClick={() => setOpenHelp(openHelp === h.id ? null : h.id)}>
                  {h.label}
                </Button>
              ))}
            </div>
            {openHelp && <HelpInput help={helps.find((h) => h.id === openHelp)!} person={person} onSave={(p) => (setOpenHelp(null), save(p))} />}
          </CardContent>
        </Card>
      )}

      {!ro && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="size-4" aria-hidden /> Tell us about {name}
            </CardTitle>
            <CardDescription>Any order. Use your phone&apos;s dictation to talk, or paste a “This is me” or a note. We keep only what you confirm.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-1.5" aria-label="Things that help">
              {HINTS.map((h) => (
                <Button key={h.label} type="button" size="xs" variant="secondary" onClick={() => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${h.starter(person.preferredName || "They")}`)}>
                  {h.label}
                </Button>
              ))}
            </div>
            <Textarea
              aria-label="Their story"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mum grew up in Manchester, born 1950. Danced at the Ritz every Saturday…"
              className="min-h-32"
              maxLength={8000}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void send()} disabled={busy || text.trim().length < 3}>
                {busy ? <Spinner /> : null} {busy ? "Reading it…" : "Add to the story"}
              </Button>
              <span className="text-xs text-muted-foreground">The words themselves aren&apos;t kept.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cards.length > 0 && (
        <section aria-labelledby="heard" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="heard" className="text-xl font-semibold">
              Here&apos;s what I heard
            </h2>
            {cards.some((c) => c.kind !== "painful") && (
              <Button size="sm" onClick={() => void confirmAll()}>
                <Check aria-hidden /> All right
              </Button>
            )}
          </div>
          {cards.map((c) =>
            c.kind === "painful" ? (
              <Card key={c.id} className="border-destructive/40">
                <CardContent className="grid gap-2 pt-6">
                  <SteerQuestion
                    question={`You mentioned ${c.value}. Steer clear of ${/^(the |loud )/i.test(c.value) ? "it" : "them"} in sessions?`}
                    onAnswer={(level) => {
                      drop(c.id);
                      void save(addSteer(person, c.value, level, /^[A-Z]/.test(c.value) && !/^The /.test(c.value) ? "person" : "topic"));
                    }}
                  />
                  {c.quote && <p className="text-xs text-muted-foreground">“{c.quote}”</p>}
                </CardContent>
              </Card>
            ) : (
              <Card key={c.id}>
                <CardContent className="grid gap-2 pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {KIND_LABEL[c.kind] && <Badge variant="outline">{KIND_LABEL[c.kind]}</Badge>}
                    {editing === c.id ? (
                      <EditFact fact={c} onDone={(f) => (setEditing(null), setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...f } : x))))} />
                    ) : (
                      <span className="font-medium">{describeFact(c)}</span>
                    )}
                  </div>
                  {c.quote && <p className="text-xs text-muted-foreground">“{c.quote}”</p>}
                  {editing !== c.id && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void confirm(c)}>
                        <Check aria-hidden /> Yes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(c.id)}>
                        <Pencil aria-hidden /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => drop(c.id)}>
                        <X aria-hidden /> Remove
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          )}
        </section>
      )}

      {!ro && (missing.length > 0 || noYears.length > 0 || (!person.steerAsked && !person.steers.length && person.places.length > 0)) && (
        <Card id="missing" className={goPressed && missing.length ? "border-primary" : undefined}>
          <CardHeader>
            <CardTitle>{missing.length ? "To build anything we need" : "A few details"}</CardTitle>
            <CardDescription>{missing.length ? `The name ${name} likes, a birth year (a decade is fine) and one place.` : "These make the suggestions better. Skip any you don't know."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {missing.includes("preferredName") && <TextInput id="m-name" label="The name they like to be called" onSave={(v) => void save({ ...person, preferredName: v.slice(0, 40) })} />}
            {missing.includes("birthYear") && (
              <YearInput
                id="m-born"
                label={`When was ${name} born?`}
                value={null}
                min={1915}
                max={1995}
                onSave={(y, choice) => y && void save(choice === "decade" ? { ...person, decade: y } : { ...person, birthYear: y })}
                choices={[1930, 1940, 1950, 1960].map((d) => ({ label: `${d}s`, value: d, choice: "decade" }))}
              />
            )}
            {missing.includes("place") && <PlaceSearch id="m-place" label={`Where did ${name} grow up?`} onPick={(pl) => void save(addPlace(person, { name: pl.name, label: pl.label, fromYear: birthYearOf(person), toYear: null, role: "grew up" }))} />}
            {missing.includes("birthYear") && (
              <p className="-mt-3 text-xs text-muted-foreground">Picking a decade keeps just the decade (the year stays unknown).</p>
            )}
            {noYears.slice(0, 2).map((pl) =>
              pl.fromYear === null ? (
                <YearInput key={pl.id} id={`from-${pl.id}`} label={`When did ${name} move to ${pl.name}?`} value={null} onSave={(y) => void save({ ...person, places: person.places.map((x) => (x.id === pl.id ? { ...x, fromYear: y } : x)) })} choices={[{ label: "Not sure", value: null }]} />
              ) : (
                <YearInput
                  key={pl.id}
                  id={`to-${pl.id}`}
                  label={`Until when was ${name} in ${pl.name}?`}
                  value={null}
                  onSave={(y) => void save({ ...person, places: person.places.map((x) => (x.id === pl.id ? { ...x, toYear: y ?? x.toYear } : x)) })}
                  choices={[{ label: "Not sure", value: null }]}
                />
              ),
            )}
            {!person.steerAsked && !person.steers.length && person.places.length > 0 && (
              <SteerTopic person={person} onSave={(p) => void save(p)} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Edit a candidate before confirming it: the value, and its years where it has them. */
function EditFact({ fact, onDone }: { fact: Candidate; onDone: (f: Partial<Fact>) => void }) {
  const [value, setValue] = useState(fact.value);
  const [from, setFrom] = useState(fact.fromYear ? String(fact.fromYear) : "");
  const [to, setTo] = useState(fact.toYear ? String(fact.toYear) : "");
  const yr = (s: string) => (/^\d{4}$/.test(s) ? Number(s) : null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Input aria-label="What it is" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-56" />
      {(fact.kind === "place" || fact.kind === "moment" || fact.kind === "birthYear" || fact.kind === "love") && (
        <Input aria-label="From year" inputMode="numeric" placeholder="year" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-8 w-20" />
      )}
      {fact.kind === "place" && <Input aria-label="Until year" inputMode="numeric" placeholder="until" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-8 w-20" />}
      <Button size="sm" onClick={() => onDone({ value: value.trim() || fact.value, fromYear: yr(from), toYear: yr(to) })}>
        Done
      </Button>
    </span>
  );
}

/** The steer-clear question when nothing's been flagged yet: a label, or "nothing to steer clear of". */
function SteerTopic({ person, onSave }: { person: Person; onSave: (p: Person) => void }) {
  const [label, setLabel] = useState("");
  return (
    <div className="grid gap-2">
      <p className="font-medium">Anything to steer clear of in sessions? A person, a topic, a sound.</p>
      <p className="text-xs text-muted-foreground">Just a short label. No reason needed.</p>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Something to steer clear of" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The war, loud bangs" className="sm:w-64" maxLength={60} />
        <Button size="sm" disabled={label.trim().length < 2} onClick={() => onSave(addSteer(person, label, "never"))}>
          Never
        </Button>
        <Button size="sm" variant="outline" disabled={label.trim().length < 2} onClick={() => onSave(addSteer(person, label, "sad_ok"))}>
          Sad but OK
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSave({ ...person, steerAsked: true })}>
          Nothing to steer clear of
        </Button>
      </div>
    </div>
  );
}

/** What's known: the story so far, each line removable. */
function Known({ person, onSave, ro }: { person: Person; onSave: (p: Person) => void; ro: boolean }) {
  const rm = (label: string, next: Person) =>
    ro ? null : (
      <Button size="icon-xs" variant="ghost" aria-label={`Remove ${label}`} onClick={() => onSave(next)}>
        <Trash2 aria-hidden />
      </Button>
    );
  const born = person.birthYear ? `Born ${person.birthYear}` : person.decade ? `Born in the ${person.decade}s` : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>What we know</CardTitle>
        <CardDescription>
          {[born, `${person.places.length} places`, `${person.moments.length} moments`, `${person.loves.length} loves`, `${person.steers.length} steer-clears`].filter(Boolean).join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {person.places.length > 0 && (
          <Row label="Places">
            {person.places.map((p) => (
              <span key={p.id} className="inline-flex items-center">
                {p.name}
                {p.fromYear ? ` ${p.fromYear}–${p.toYear ?? "?"}` : ""}
                {rm(p.name, { ...person, places: person.places.filter((x) => x.id !== p.id) })}
              </span>
            ))}
          </Row>
        )}
        {person.moments.length > 0 && (
          <Row label="Moments">
            {person.moments.map((m) => (
              <span key={m.id} className="inline-flex items-center">
                {m.label}
                {m.year ? `, ${m.year}` : ""}
                {rm(m.label, { ...person, moments: person.moments.filter((x) => x.id !== m.id) })}
              </span>
            ))}
          </Row>
        )}
        {person.loves.length > 0 && (
          <Row label="Loves">
            {person.loves.map((l) => (
              <span key={l.id} className="inline-flex items-center">
                {l.title}
                {l.by ? ` (${l.by})` : ""}
                {l.source === "ring_a_bell" ? <Badge variant="outline">rang a bell</Badge> : l.source === "staff_heard" ? <Badge variant="outline">staff heard</Badge> : null}
                {rm(l.title, { ...person, loves: person.loves.filter((x) => x.id !== l.id) })}
              </span>
            ))}
          </Row>
        )}
        {person.steers.length > 0 && (
          <Row label="Steer clear">
            {person.steers.map((s) => (
              <span key={s.id} className="inline-flex items-center">
                {s.label} ({s.level === "never" ? "never" : "sad but OK"})
                {rm(s.label, { ...person, steers: person.steers.filter((x) => x.id !== s.id) })}
              </span>
            ))}
          </Row>
        )}
        {Object.entries({ Calms: person.practical.calms, Work: person.practical.work, Hearing: person.practical.hearing, Greeting: person.practical.greeting, "Best time": person.practical.bestTime }).map(([k, v]) =>
          v ? (
            <Row key={k} label={k}>
              <span>{v}</span>
            </Row>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">{children}</span>
    </div>
  );
}

/** The typed input behind a "would help next" chip. */
function HelpInput({ help, person, onSave }: { help: Help; person: Person; onSave: (p: Person) => void }) {
  const name = person.preferredName || "they";
  switch (help.kind) {
    case "upset":
      return (
        <div className="grid gap-2">
          <p className="font-medium">
            {name} was upset during {help.itemTitle}. Steer clear of it?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onSave(addSteer(person, help.itemTitle, "never", "item", "logged"))}>
              Never
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSave({ ...person, resolvedUpsets: [...person.resolvedUpsets, help.itemKey] })}>
              Sad but OK
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSave({ ...person, resolvedUpsets: [...person.resolvedUpsets, help.itemKey] })}>
              A one-off
            </Button>
          </div>
        </div>
      );
    case "steer":
      return <SteerTopic person={person} onSave={onSave} />;
    case "place":
      return (
        <PlaceSearch
          id="h-place"
          label={help.label}
          onPick={(pl) => onSave(addPlace(person, { name: pl.name, label: pl.label, fromYear: person.places.at(-1)?.toYear ?? null, toYear: null, role: "lived" }))}
        />
      );
    case "moment":
      return (
        <TextInput
          id="h-moment"
          label="A wedding, dancing, a move: what and when"
          placeholder="e.g. Married at St Mary's in 1972"
          onSave={(t) => {
            const year = t.match(/(19|20)\d\d/)?.[0];
            const kind = /marri|wedd/i.test(t) ? "wedding" : /danc/i.test(t) ? "dance" : /mov/i.test(t) ? "move" : /servic|army|navy|raf/i.test(t) ? "service" : "other";
            onSave({ ...person, moments: [...person.moments, { id: uid("mo"), kind, year: year ? Number(year) : null, label: t }] });
          }}
        />
      );
    case "calms":
      return <TextInput id="h-calms" label={`What calms ${name}?`} placeholder="e.g. Dusty, softly; holding a hand" onSave={(t) => onSave({ ...person, practical: { ...person.practical, calms: t } })} />;
    case "work":
      return <TextInput id="h-work" label="Their work, trade or skills" placeholder="e.g. A shop on Market Street; sewing" onSave={(t) => onSave({ ...person, practical: { ...person.practical, work: t } })} />;
    case "faith":
      return (
        <div className="grid gap-2">
          <p className="font-medium">Faith in sessions?</p>
          <div className="flex flex-wrap gap-2">
            <TextInput id="h-faith" label="Yes: which (hymns, festivals)" onSave={(t) => onSave({ ...person, practical: { ...person.practical, faith: { stance: "yes", label: t.slice(0, 60) } } })} />
            <Button size="sm" variant="outline" className="self-end" onClick={() => onSave({ ...person, practical: { ...person.practical, faith: { stance: "keep_out" } } })}>
              Keep it out
            </Button>
          </div>
        </div>
      );
    case "hearing":
      return (
        <div className="grid gap-2">
          <TextInput id="h-hearing" label="Hearing" placeholder="e.g. Hears better on the left" onSave={(t) => onSave({ ...person, practical: { ...person.practical, hearing: t } })} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            Headphones:
            <Button size="sm" variant="outline" onClick={() => onSave({ ...person, practical: { ...person.practical, headphonesOk: true } })}>
              Fine
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSave({ ...person, practical: { ...person.practical, headphonesOk: false } })}>
              No headphones
            </Button>
          </div>
        </div>
      );
    case "heard": {
      const h = person.staffHeard.find((x) => x.id === help.heardId)!;
      return (
        <div className="grid gap-2">
          <p className="font-medium">Staff heard in a session: “{h.text}”. Is that right?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onSave({ ...person, staffHeard: person.staffHeard.map((x) => (x.id === h.id ? { ...x, confirmed: true } : x)) })}>
              Yes, keep it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSave({ ...person, staffHeard: person.staffHeard.filter((x) => x.id !== h.id) })}>
              Not right
            </Button>
          </div>
        </div>
      );
    }
  }
}
