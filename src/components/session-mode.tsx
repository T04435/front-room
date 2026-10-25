"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, Copy, ExternalLink, Eye, Moon, Music, OctagonX, Play, Sun, TriangleAlert, Waves } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { careNote } from "@/lib/care-note";
import { RESPONSE_LABELS, RESPONSES, type Kit, type KitItem, type LogEntry, type Response } from "@/lib/kit";
import { defaultGoal, GOAL_HINTS, GOAL_LABELS, GOALS, type Goal } from "@/lib/learning";
import { HEARD_KINDS, type Person } from "@/lib/person";
import { storyPatch, uid } from "@/lib/story";
import { cn } from "@/lib/utils";

const ICONS: Record<(typeof RESPONSES)[number], typeof Waves> = { calm: Waves, engaged: Eye, sang: Music, upset: TriangleAlert };
const HEARD_LABELS: Record<(typeof HEARD_KINDS)[number], string> = { name: "A name", place: "A place", job: "A job", song: "A song", dance: "A dance", other: "Something else" };
const REASON: Record<NonNullable<KitItem["reason"]>, string> = { proven: "Proven", family_yes: "Family said yes", era_match: "Their era", new_try: "New try" };
const hm = (d = new Date()) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

type WakeLock = { release: () => Promise<void> };

/**
 * Session mode (v2 brief, P0 6): on a phone, one item per screen in large type; four log buttons in thumb reach; Stop
 * always visible (logs the upset and moves to a proven calm track); the screen kept awake; a dim theme for evenings.
 * At the end: "Learned something?" and a care-note line to copy.
 */
export function SessionMode({ person, goal: asked }: { person: Person; goal: Goal | null }) {
  const [goal, setGoal] = useState<Goal | null>(asked);
  const [suggested, setSuggested] = useState<Goal>("chat");
  const [kit, setKit] = useState<(Kit & { preview?: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dim, setDim] = useState(false);
  const [ended, setEnded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState("");
  const building = useRef(false);
  const name = person.preferredName;

  // Settle is suggested after 17:00, by the device's own clock.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSuggested(defaultGoal()), []);

  useEffect(() => {
    if (!goal || building.current) return;
    building.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/people/${person.id}/kit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) });
        const body = (await res.json()) as Kit & { preview?: boolean; error?: string };
        if (!res.ok) throw new Error(body.error ?? "The session couldn't be set out.");
        setKit(body);
        setStartedAt(new Date().toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : "The session couldn't be set out.");
        building.current = false;
      }
    })();
  }, [goal, person.id]);

  // Keep the screen awake during the session (refused or unsupported is fine).
  useEffect(() => {
    if (!kit || ended) return;
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [kit, ended]);

  if (!goal) {
    return (
      <div className="grid gap-4">
        <h1 className="text-3xl font-semibold">A session with {name}</h1>
        <p className="text-muted-foreground">Pick the kind of session.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {GOALS.map((g) => (
            <Button key={g} variant={g === suggested ? "default" : "outline"} className="h-auto flex-col items-start gap-1 py-3 text-left whitespace-normal" onClick={() => setGoal(g)}>
              <span className="font-semibold">
                {GOAL_LABELS[g]}
                {g === suggested ? " · suggested now" : ""}
              </span>
              <span className="text-xs font-normal opacity-80">{GOAL_HINTS[g]}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="grid gap-4">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/p/${person.id}/bell`}>Ring a bell?</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/p/${person.id}`}>Back to {name}</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!kit) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Spinner /> Setting out {name}&apos;s {GOAL_LABELS[goal]} session: what&apos;s proven, what the family said yes to, and a few new tries…
      </p>
    );
  }

  const order = [...kit.items.filter((i) => i.type === "song"), ...kit.items.filter((i) => i.type !== "song")];
  const item = order[at];
  const ro = Boolean(kit.preview);
  const mine = logs.filter((l) => l.itemRef === item?.ref && l.response !== "none");
  // This item's own prompt, else one about the story in general (never one about a different item).
  const general = kit.prompts.filter((p) => !p.refs.length);
  const prompt = kit.prompts.find((p) => p.refs.includes(item?.ref ?? "")) ?? (general.length ? general[at % general.length] : undefined);

  async function log(response: Response, ref = item?.ref ?? null) {
    if (ro) return;
    try {
      const res = await fetch(`/api/kits/${kit!.id}/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response, itemRef: ref }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save.");
      const entry = (await res.json()) as LogEntry;
      setLogs((xs) => [...xs, entry]);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That didn't save.");
    }
  }

  /** Moving on with nothing logged counts as no reaction (three of those and an item rests). */
  async function move(to: number) {
    if (item && !logs.some((l) => l.itemRef === item.ref)) await log("none");
    setNotice(null);
    if (to >= order.length) setEnded(true);
    else setAt(Math.max(0, to));
  }

  async function stop() {
    if (item) await log("upset");
    const calm = order.findIndex((i, n) => n !== at && i.type === "song" && i.reason === "proven" && i.phase === "calm") ?? -1;
    const fallback = order.findIndex((i, n) => n !== at && i.type === "song" && i.phase === "calm");
    const next = calm >= 0 ? calm : fallback;
    if (next >= 0) {
      setAt(next);
      setNotice(`Stopped. Logged as upset. Something calm instead: ${order[next].title}.`);
    } else setNotice("Stopped and logged as upset. Take a break.");
  }

  if (ended) return <SessionEnd person={person} kit={kit} logs={logs} startedAt={startedAt} ro={ro} />;

  return (
    <div className={cn("-mx-4 -my-10 grid min-h-[80vh] gap-4 px-4 py-6", dim && "bg-neutral-950 text-neutral-300")}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {GOAL_LABELS[kit.goal ?? goal]} · {startedAt ? hm(new Date(startedAt)) : ""} · {at + 1} of {order.length}
        </span>
        <span className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDim((d) => !d)} aria-pressed={dim}>
            {dim ? <Sun aria-hidden /> : <Moon aria-hidden />} {dim ? "Bright" : "Dim"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEnded(true)}>
            End
          </Button>
        </span>
      </div>
      {ro && (
        <Alert>
          <AlertDescription>The example&apos;s next session, as a preview: logging is off. Try your own person to run a session.</AlertDescription>
        </Alert>
      )}

      {item && (
        <Card className={cn(dim && "border-neutral-800 bg-neutral-900 text-neutral-200")}>
          <CardContent className="grid gap-2 pt-6">
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {item.type === "song" ? "Now" : item.type === "film" ? "Film" : item.type === "tv" ? "TV" : "Place"}
              {item.reason && <Badge variant={item.reason === "new_try" ? "secondary" : "outline"}>{item.reason === "new_try" && item.like ? `New try · like ${item.like}` : item.why && item.reason === "proven" ? item.why : REASON[item.reason]}</Badge>}
            </span>
            <span className="text-3xl leading-tight font-semibold">{item.title}</span>
            {(item.by || item.year) && <span className="text-lg text-muted-foreground">{[item.by?.title, item.year].filter(Boolean).join(", ")}</span>}
            <span className="flex flex-wrap gap-2 pt-1">
              {item.links ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <a href={item.links.spotify} target="_blank" rel="noreferrer">
                      <Play aria-hidden /> Spotify
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={item.links.youtube} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden /> YouTube
                    </a>
                  </Button>
                </>
              ) : item.type !== "place" ? (
                <Button asChild variant="outline" size="sm">
                  <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} ${item.year ?? ""} clip`)}`} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden /> Find clips on YouTube
                  </a>
                </Button>
              ) : null}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{item.parts.join(" · ")}</span>
          </CardContent>
        </Card>
      )}

      {prompt && (
        <Card className={cn(dim && "border-neutral-800 bg-neutral-900 text-neutral-200")}>
          <CardContent className="grid gap-1 pt-6">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">You could say</span>
            <span className="text-xl font-medium">“{prompt.text}”</span>
            {prompt.reply && <span className="text-sm text-muted-foreground">They might answer: {prompt.reply}</span>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Log a response">
        {RESPONSES.map((r) => {
          const Icon = ICONS[r];
          const on = mine.some((l) => l.response === r);
          return (
            <Button key={r} variant={on ? "default" : "outline"} className="h-16 justify-start text-lg" disabled={ro} aria-pressed={on} onClick={() => void log(r)}>
              {on ? <Check aria-hidden /> : <Icon aria-hidden className={r === "upset" ? "text-destructive" : undefined} />} {RESPONSE_LABELS[r]}
            </Button>
          );
        })}
      </div>
      <p aria-live="polite" className="min-h-6 text-sm">
        {notice ?? (mine.length ? `Logged: ${mine.map((l) => RESPONSE_LABELS[l.response]).join(", ")} · ${hm(new Date(mine.at(-1)!.at))}` : "Tap as often as you like.")}
      </p>

      <Button variant="destructive" className="h-14 text-lg" onClick={() => void stop()} disabled={ro}>
        <OctagonX aria-hidden /> Stop · play something calm
      </Button>
      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={at === 0} onClick={() => void move(at - 1)}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <Button onClick={() => void move(at + 1)}>
          {at + 1 >= order.length ? "Finish" : "Next"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** The end of a session: "Learned something?" (saved as staff-heard, for the family to confirm) and the care note. */
function SessionEnd({ person, kit, logs, startedAt, ro }: { person: Person; kit: Kit; logs: LogEntry[]; startedAt: string; ro: boolean }) {
  const [kind, setKind] = useState<(typeof HEARD_KINDS)[number] | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [endedAt] = useState(() => new Date().toISOString());
  const note = careNote(kit, logs, startedAt, endedAt);

  async function keep() {
    if (!kind || text.trim().length < 2) return;
    const next = { ...person, staffHeard: [...person.staffHeard, { id: uid("sh"), kind, text: text.trim(), at: new Date().toISOString(), kitId: kit.id }] };
    const res = await fetch(`/api/people/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(storyPatch(next)) });
    if (res.ok) {
      Object.assign(person, (await res.json()) as Person);
      setSaved((s) => [...s, `${HEARD_LABELS[kind]}: ${text.trim()}`]);
      setText("");
      setKind(null);
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Session done</h1>
      <Card>
        <CardContent className="grid gap-2 pt-6">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Care note</span>
          <p className="text-lg">{note}</p>
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(note);
                setCopied(true);
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy for the records"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Observations only, not a clinical score.</p>
        </CardContent>
      </Card>
      {!ro && (
        <Card>
          <CardContent className="grid gap-3 pt-6">
            <span className="font-semibold">Learned something?</span>
            <div className="flex flex-wrap gap-2">
              {HEARD_KINDS.map((k) => (
                <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
                  {HEARD_LABELS[k]}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setSaved((s) => [...s, "Nothing new"])}>
                Nothing new
              </Button>
            </div>
            {kind && (
              <div className="flex flex-wrap gap-2">
                <Input aria-label={HEARD_LABELS[kind]} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. worked at the cotton mill" className="sm:w-80" maxLength={200} />
                <Button size="sm" onClick={() => void keep()} disabled={text.trim().length < 2}>
                  Save
                </Button>
              </div>
            )}
            {saved.length > 0 && <p className="text-sm text-muted-foreground">Saved: {saved.join(" · ")}. The family can confirm it in the story chat.</p>}
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/p/${person.id}/works`}>What works</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/p/${person.id}`}>Back to {person.preferredName}</Link>
        </Button>
      </div>
    </div>
  );
}
