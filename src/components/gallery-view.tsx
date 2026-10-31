"use client";

import { Ban, BookOpen, Check, Droplet, Plus, ExternalLink, Eye, Film, Heart, MapPin, MessageCircle, MessageCircleHeart, Music, OctagonX, Play as PlayIcon, Sparkles, ThumbsDown, TriangleAlert, Tv, Undo2, Waves } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CopyLink } from "@/components/person-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { calmPick, settlePick, TYPE_WORD, type Gallery, type GalleryItem, type GalleryType } from "@/lib/gallery";
import { RESPONSE_LABELS } from "@/lib/kit";
import type { Play } from "@/lib/learning";
import { HEARD_KINDS, type Person, type StaffHeard, talkingPoints } from "@/lib/person";
import { cn } from "@/lib/utils";

const ICON: Record<GalleryType, typeof Music> = { song: Music, film: Film, tv: Tv, book: BookOpen, place: MapPin };
// Tile grounds from the brand palette (Apricot, Rose, Plum tints), behind the picture or the icon.
const TILE: Record<GalleryType, string> = {
  song: "bg-accent/60 text-accent-foreground",
  film: "bg-secondary text-primary",
  tv: "bg-muted text-primary",
  book: "bg-accent/30 text-primary",
  place: "bg-secondary/70 text-primary",
};
const SHELF: Record<GalleryType, string> = { song: "Songs", film: "Films", tv: "On the telly", book: "Books", place: "Places they knew" };
const LOG_ICON = { calm: Waves, engaged: Eye, sang: Music, talked: MessageCircle, tearful: Droplet, upset: TriangleAlert } as const;
const HEARD_LABELS: Record<StaffHeard["kind"], string> = { name: "A name", place: "A place", job: "A job", song: "A song", dance: "A dance", other: "Something else" };
const noop = () => () => {};
/** After 17:00 on this device: calm first, as the brief's evening default. Off during server render. */
const useEvening = () => useSyncExternalStore(noop, () => new Date().getHours() >= 17, () => false);
/**
 * Who the card speaks to: staff on shift, or family visiting (PR-12, PR-12a). A choice on this device wins; else staff.
 * Storage may be blocked: then staff.
 */
const MODE_KEY = "fr-card-mode";
const MODE_EVENT = "fr-card-mode";
const readMode = (): "staff" | "visit" | null => {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "staff" || v === "visit" ? v : null;
  } catch {
    return null;
  }
};
const subscribeMode = (cb: () => void) => {
  window.addEventListener(MODE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(MODE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
function useCardMode(): ["staff" | "visit", (m: "staff" | "visit") => void] {
  const chosen = useSyncExternalStore(subscribeMode, readMode, () => null);
  const set = (m: "staff" | "visit") => {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
    window.dispatchEvent(new Event(MODE_EVENT));
  };
  // Staff unless someone chose a visit on this device: a clock default flipped the card at an 18:00 demo (QA-52).
  return [chosen ?? "staff", set];
}
// Times in the home's zone everywhere (QA-16); the demo homes are in the UK.
// Said so on screen, for anyone reading from elsewhere (A18).
const hm = (iso: string) => `${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} UK time`;

/** A small tag: why it's here, or how it's gone. Tiles keep four (UX-4): Ask family, Works, New try, From the family. */
function tagOf(g: GalleryItem, tile = false): string | null {
  if (g.askFamily) return "Ask family";
  if (tile) return g.stat?.state === "proven" ? "Works" : g.origin === "new_try" ? "New try" : g.origin === "family" ? "From the family" : null;
  if (g.stat?.state === "proven") return g.stat.sangSessions >= 2 ? "Sings along" : "Works";
  if (g.standIn) return "New try · stand-in";
  if (g.origin === "new_try") return g.like ? `New try · like ${g.like}` : "New try";
  if (g.answer === "yes") return "Loved it";
  if (g.origin === "family") return "From the family";
  if (g.story) return "From their story";
  if (g.stat?.state === "tried") return "Tried";
  return null;
}

/**
 * A person's gallery: what to play for them right now. Spotify and Netflix in one: shelves of songs, films, TV, books
 * and places from Qloo for their life and places, and what the family said they love. Tap one to play it (Spotify,
 * YouTube; nothing hosted here) and log how it went; the gallery learns from it.
 */
export function GalleryView({ person, gallery, plays, stale, triesDue, songsPending = false, picturesDue = false }: { person: Person; gallery: Gallery; plays: Play[]; stale: boolean; triesDue: boolean; songsPending?: boolean; picturesDue?: boolean }) {
  const router = useRouter();
  const [open, setOpenItem] = useState<GalleryItem | null>(null);
  // Opened to settle them (Stop, or Something calm now): the sheet starts with the basics to check first.
  const [settling, setSettling] = useState(false);
  // Focus goes back to the tile that opened the sheet (QA-12).
  const opener = useRef<HTMLElement | null>(null);
  const setOpen = (g: GalleryItem | null, settle = false) => {
    if (g && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    setOpenItem(g);
    setSettling(settle);
  };
  const [logged, setLogged] = useState<Play[]>(plays);
  const [notice, setNotice] = useState<string | null>(null);
  // Shown on the page when Stop closes the sheet with nothing calm to open (QA-25).
  const [stopped, setStopped] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ro = Boolean(person.example);
  const name = person.preferredName;
  const [findingTries, setFindingTries] = useState(triesDue);
  const [since] = useState(() => new Date().toISOString());
  const evening = useEvening();
  // Start here: what works (else the family's song), one new try, one thing to talk about (PR-6).
  // While new tries load (or when there are none), the third is another song, a film or a place (A14).
  const calmNow = calmPick(gallery) ?? gallery.shelves.song.find((g) => g.origin === "family") ?? null;
  const startHere = [
    // Evening: something proven calm first, when there is one (UX-8).
    ...(evening && calmPick(gallery) ? [calmPick(gallery)!] : []),
    gallery.works[0] ?? gallery.shelves.song.find((g) => g.origin === "family") ?? gallery.shelves.song[0],
    gallery.newTries[0],
    gallery.shelves.place.find((g) => g.story) ?? gallery.shelves.film[0] ?? gallery.shelves.place[0],
    gallery.shelves.song[1],
    gallery.shelves.film[0],
    gallery.shelves.place[0],
  ]
    .filter((g, i, xs): g is GalleryItem => Boolean(g) && xs.findIndex((x) => x?.key === g?.key) === i)
    .slice(0, 3);
  // Shown once: Start here and Works aren't repeated on the shelves below (FC-12, UX-4).
  const shown = new Set([...startHere, ...gallery.works].map((g) => g.key));
  const newTries = gallery.newTries.filter((g) => !startHere.some((x) => x.key === g.key));
  const isOpen = open !== null;

  // Cards from before pictures were kept: fetch theirs once, quietly, then show them.
  useEffect(() => {
    if (!picturesDue) return;
    fetch(`/api/people/${person.id}/pictures`, { method: "POST" })
      .then((r) => r.json())
      .then((b: { changed?: boolean }) => b.changed && router.refresh())
      .catch(() => {});
  }, [picturesDue, person.id, router]);

  // Songs still being checked after a look-up: refresh until they land.
  useEffect(() => {
    if (!songsPending) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [songsPending, router]);

  // Keep the screen on while something's playing (refusal is fine).
  useEffect(() => {
    if (!isOpen || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    navigator.wakeLock
      .request("screen")
      .then((l) => (live ? (lock = l) : void l.release()))
      .catch(() => {});
    return () => {
      live = false;
      void lock?.release().catch(() => {});
    };
  }, [isOpen]);

  // What works changed since the new tries were found: find new ones like it, quietly, then show them.
  useEffect(() => {
    if (!triesDue) return;
    let live = true;
    fetch(`/api/people/${person.id}/new-tries`, { method: "POST" })
      .then((r) => r.json())
      // Refresh whatever the answer: in development the first of two requests can be the one that found them (QA-27).
      .then(() => router.refresh())
      .catch(() => {})
      .finally(() => live && setFindingTries(false));
    return () => {
      live = false;
    };
  }, [triesDue, person.id, router]);

  async function log(g: GalleryItem, response: Play["response"]) {
    if (ro) return;
    const res = await fetch(`/api/people/${person.id}/plays`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemKey: g.key, type: g.type, title: g.title, ...(g.by ? { by: g.by } : {}), response }) });
    if (!res.ok) return setNotice(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save. Check the connection and tap again.");
    const play = (await res.json()) as Play;
    setLogged((xs) => [...xs, play]);
    setNotice(null);
    // The shelves learn at once: an upset pauses the item, a second good day makes it proven.
    router.refresh();
  }

  async function undo(play: Play) {
    setLogged((xs) => xs.filter((x) => x.id !== play.id));
    await fetch(`/api/people/${person.id}/plays?play=${play.id}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  }

  /** Stop: logs the upset, and opens something that settles them (what's proven calm, else what works, else the family's). */
  async function stop(g: GalleryItem) {
    await log(g, "upset");
    // Something logged calm, else a song the family named (FC-5); never the song just stopped.
    const pick = settlePick(gallery, person, g);
    const calm = pick?.logged ? pick.item : null;
    const family = pick && !pick.logged ? pick.item : null;
    const calms = person.practical.calms?.trim();
    setOpen(pick?.item ?? null, true);
    if (calm) setNotice(`Stopped and logged as upset. Something that has calmed ${name}: ${calm.title}.`);
    else if (family) setNotice(`Stopped and logged as upset. A song the family chose for ${name}: ${family.title}.${calms ? ` The family says ${name} is calmed by: ${calms}.` : ""}`);
    else if (calms) setStopped(`Stopped and logged as upset. The family says ${name} is calmed by: ${calms}. First check the basics (pain, hungry or thirsty, the toilet, too hot or cold).`);
    else setStopped(`Stopped and logged as upset. Nothing has been logged calm for ${name} yet: take a break, and first check the basics (pain, hungry or thirsty, the toilet, too hot or cold). Sit with them quietly.`);
  }

  async function answer(g: GalleryItem, a: "yes" | "upset") {
    if (ro || !g.cardId) return;
    setBusy(g.key);
    const res = await fetch(`/api/people/${person.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card: g.cardId, answer: g.answer === a ? null : a }) });
    setBusy(null);
    if (!res.ok) return setNotice("That didn't save. Check the connection and tap again.");
    if (a === "upset") setOpen(null);
    router.refresh();
  }

  // Taps on this item during this visit.
  const mine = open ? logged.filter((p) => p.itemKey === open.key && p.response !== "none" && p.at >= since) : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-heading text-[34px] leading-[40px]">{name}</h1>
            <p className="text-muted-foreground">Things to play and talk about with {name}. Tap one to play it.</p>
          </div>
          {/* One filled action: something calm now (UX-1). On a phone: Something calm now on its own row, the other two side by side (R2-4). */}
          <div className="flex flex-wrap gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2">
            {calmNow && (
              <Button className="max-sm:col-span-2 max-sm:h-11" onClick={() => setOpen(calmNow, true)}>
                <Waves aria-hidden /> Something calm now
              </Button>
            )}
            <Button asChild variant="outline" className="max-sm:min-h-11">
              <Link href={`/p/${person.id}/works`}>What works</Link>
            </Button>
            {/* On a phone: two equal outline buttons, one line each; the full name stays the accessible one. */}
            <Button asChild variant="ghost" className="max-sm:min-h-11 max-sm:border-2 max-sm:border-input max-sm:bg-card">
              <Link href={`/p/${person.id}/story`} aria-label={`Tell me more about ${name}`}>
                <MessageCircleHeart aria-hidden /> <span className="sm:hidden">Tell me more</span>
                <span className="max-sm:hidden">Tell me more about {name}</span>
              </Link>
            </Button>
          </div>
        </div>
        {ro && (
          <Alert>
            <AlertDescription>A fictional person with five days of play, so you can see what works rise to the top. Read-only: add your own person to play and log.</AlertDescription>
          </Alert>
        )}
        {stale && !ro && (
          <Alert>
            <Sparkles />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {name}&apos;s story has new places or loves.
              <Button asChild size="sm">
                <Link href={`/p/${person.id}/story?find=1`}>Find more for {name}</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {stopped && (
        <Alert role="status" className="fixed inset-x-4 bottom-4 z-50 max-w-[calc(100vw-2rem)] shadow-lg sm:mx-auto sm:max-w-xl">
          <Waves />
          <AlertDescription className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0 break-words">{stopped}</span>
            <Button size="sm" variant="ghost" onClick={() => setStopped(null)}>
              OK
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {songsPending && (
        <p className="flex items-center gap-2 text-muted-foreground" role="status">
          <Spinner /> Checking {name}&apos;s songs one by one on MusicBrainz; they&apos;ll appear here in a minute.
        </p>
      )}

      <Handover person={person} gallery={gallery} />

      {startHere.length > 1 && <Shelf title="Start here" hint="Three to begin with" items={startHere} onOpen={setOpen} limit={3} grid />}

      {gallery.works.length > 0 && (
        <Shelf
          title={`Works for ${name}`}
          hint={evening ? "Evening: the calm ones first" : "Sang along or engaged on two days"}
          items={evening ? [...gallery.works].sort((a, b) => (b.stat?.calmSessions ?? 0) - (a.stat?.calmSessions ?? 0)) : gallery.works}
          onOpen={setOpen}
          big
        />
      )}
      {/* What Start here already shows isn't repeated in New tries (FC-12). */}
      {newTries.length > 0 && <Shelf title="New tries" hint={newTries.find((g) => g.worked)?.like ? `Because ‘${newTries.find((g) => g.worked)!.like}’ worked for ${name}` : "Like what the family says they love"} items={newTries} onOpen={setOpen} />}
      {findingTries && gallery.newTries.length === 0 && <p className="text-sm text-muted-foreground">Finding new tries like what {gallery.works.length ? `works for ${name}` : `${name} loves`}…</p>}
      {(["song", "film", "tv", "book", "place"] as const).map((t) => {
        const items = gallery.shelves[t].filter((g) => !shown.has(g.key));
        return items.length ? <Shelf key={t} title={SHELF[t]} items={items} onOpen={setOpen} /> : null;
      })}

      {/* How to keep adding, after the shelves: the story chat is where everything new comes in. */}
      {!ro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-input p-4">
          <p className="min-w-0 flex-1 basis-64">
            <span className="font-medium">Know more about {name}?</span>{" "}
            <span className="text-muted-foreground">Another place they lived, a song they always sang, what calms them: each thing you add finds more for this gallery.</span>
          </p>
          <Button asChild className="max-sm:h-11 max-sm:w-full">
            <Link href={`/p/${person.id}/story`}>
              <MessageCircleHeart aria-hidden /> Tell me more about {name}
            </Link>
          </Button>
        </div>
      )}

      <HowQloo name={name} places={person.places.map((x) => x.name)} />

      {/* Sharing, quietly, after the shelves (UX-11). */}
      {!ro && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <CopyLink path={`/p/${person.id}`} /> Anyone with this link can see and add to {name}&apos;s page.
        </div>
      )}

      {/* Folded until wanted (UX-12). */}
      {(gallery.paused.length > 0 || gallery.resting.length > 0) && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer py-2">Paused and resting ({gallery.paused.length + gallery.resting.length})</summary>
          <div className="grid gap-1">
            {gallery.paused.length > 0 && <p>Paused after an upset: {gallery.paused.map((g) => `‘${g.title}’`).join(", ")}. The family is asked about it in Tell me more.</p>}
            {gallery.resting.length > 0 && <p>Resting for a month (no reaction three times): {gallery.resting.map((g) => `‘${g.title}’`).join(", ")}.</p>}
          </div>
        </details>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && (setOpen(null), setNotice(null))}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] w-full max-w-[100vw] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-x-none sm:mx-auto sm:max-w-xl sm:rounded-t-xl"
          onCloseAutoFocus={(e) => {
            if (!opener.current?.isConnected) return;
            e.preventDefault();
            opener.current.focus();
          }}
        >
          {open && (
            // Clipped, not scrolled: nothing inside can widen the sheet, even by a shadow (FC-1b).
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-x-clip px-4 pb-4">
              {settling && (
                <Alert className="mt-8 max-sm:mt-12">
                  <Waves />
                  {/* What Stop did goes up here, in its own place, not under the sticky Stop button (A16). */}
                  <AlertDescription>
                    {notice?.startsWith("Stopped") && <span className="block font-medium">{notice}</span>}
                    First, the basics: are they in pain, hungry or thirsty, needing the toilet, too hot or cold? Then try this, softly, and sit with them.
                  </AlertDescription>
                </Alert>
              )}
              <SheetHeader className="flex-row items-start gap-3 px-0">
                {open.image && (
                  <span className={cn("relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24", TILE[open.type])}>
                    <Art src={open.image} />
                  </span>
                )}
                <span className="grid min-w-0 gap-1">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {TYPE_WORD[open.type]}
                  {tagOf(open) && <Badge variant="secondary">{tagOf(open)}</Badge>}
                </span>
                <SheetTitle className="text-2xl leading-tight sm:text-3xl">{open.title}</SheetTitle>
                <SheetDescription className="text-lg">{[open.by, open.year].filter(Boolean).join(", ")}</SheetDescription>
                </span>
              </SheetHeader>
              <div className="flex flex-wrap gap-2">
                {open.links.map((l, i) => (
                  <Button key={l.href} asChild variant={i === 0 ? "default" : "outline"} className="max-sm:h-11">
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {i === 0 ? <PlayIcon aria-hidden /> : <ExternalLink aria-hidden />} {l.label}
                    </a>
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
                <p className="text-lg leading-snug">{open.hook}</p>
                <p>
                  <span className="text-sm text-muted-foreground">Try asking</span>
                  <br />“{open.prompt.ask}”
                </p>
                <p className="text-sm text-muted-foreground">They might answer: {open.prompt.might}</p>
              </div>
              {/* What Qloo matched, in words (A8), not a source code line. */}
              <p className="leading-snug">
                <span className="font-medium">Why this:</span> {open.why}
              </p>

              {/* One shrinkable column: the Stop label can't set the sheet's width (R2-1). */}
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                <span className="text-sm font-medium">How did {name} respond?</span>
                <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2" role="group" aria-label="Log a response">
                  {/* Two by two (UX-2): "Sang along" for songs and the telly, "Talked" for the rest. Upset is Stop's job. */}
                  {(["calm", "engaged", open.type === "song" || open.type === "tv" ? "sang" : "talked", "tearful"] as const).map((r) => {
                    const Icon = LOG_ICON[r];
                    const on = mine.some((p) => p.response === r);
                    return (
                      <Button key={r} variant={on ? "default" : "outline"} className="h-12 min-w-0 justify-start text-base whitespace-normal" disabled={ro} aria-pressed={on} onClick={() => void log(open, r)}>
                        {on ? <Check aria-hidden /> : <Icon aria-hidden />} {RESPONSE_LABELS[r]}
                      </Button>
                    );
                  })}
                </div>
                {/* One steady height before and after a tap, so the sheet doesn't jump (FC-9). */}
                <p aria-live="polite" className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-2 text-sm break-words">
                  {(settling && notice?.startsWith("Stopped") ? null : notice) ??
                    (mine.length ? (
                      <>
                        Logged: {RESPONSE_LABELS[mine.at(-1)!.response]} · {hm(mine.at(-1)!.at)} · the next shift will see this
                        <Button size="sm" variant="ghost" className="max-sm:h-11" onClick={() => void undo(mine.at(-1)!)}>
                          <Undo2 aria-hidden /> Undo
                        </Button>
                      </>
                    ) : ro ? (
                      "Logging is off for the example."
                    ) : (
                      "Tap as often as you like. Each tap is saved with the time."
                    ))}
                </p>
                {/* Always in reach: it sticks to the bottom of the sheet on a phone (QA-65). */}
                <Button variant="destructive" className={cn("h-auto min-h-12 whitespace-normal", !ro && "sticky bottom-2 z-10 bg-[color-mix(in_oklch,var(--destructive)_12%,var(--popover))] shadow-[var(--shadow-card)]")} disabled={ro} onClick={() => void stop(open)}>
                  <OctagonX aria-hidden /> Upset? Stop · something calm instead
                </Button>
              </div>

              {/* The rest folds away (UX-2). */}
              {!ro && (
                <details className="min-w-0 border-t pt-2">
                  <summary className="cursor-pointer py-2 text-sm font-medium">More about this</summary>
                  <div className="grid gap-3 pt-1">
                    {open.cardId && open.origin !== "family" && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">From Qloo for their years.</span>
                        <Button size="sm" variant={open.answer === "yes" ? "default" : "outline"} className="max-sm:h-11" disabled={busy === open.key} onClick={() => void answer(open, "yes")}>
                          <Heart aria-hidden /> Loved it
                        </Button>
                        <Button size="sm" variant="outline" className="max-sm:h-11" disabled={busy === open.key} onClick={() => void answer(open, "upset")}>
                          <ThumbsDown aria-hidden /> Not for them
                        </Button>
                      </div>
                    )}
                    <LearnedSomething key={open.key} person={person} name={name} onSaved={() => router.refresh()} />
                  </div>
                </details>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * How Qloo finds these (A8): the story's places and years go to Qloo, one look-up per town and era, and everything is
 * filtered by steer clear. Folded, below the shelves, for anyone who wants to know (UX-1).
 */
function HowQloo({ name, places }: { name: string; places: string[] }) {
  const steps = [
    ["Their story", `The family tells the Go-Between about ${name}: where they lived and when, what they loved, what to steer clear of.`],
    ["Places and years", `Each place becomes a real town (${places.slice(0, 2).join(", ") || "where they lived"}) and the years ${name} was there, best between about 10 and 30.`],
    ["Qloo, per town and era", "Qloo finds artists of those decades (the town’s own music first), films and TV from those years popular there, long-standing places, the venues the story names, and things like what they love."],
    ["Steer clear", "Anything that touches steer clear is left out, everywhere. The model only picks a song per artist, checked on MusicBrainz, and writes the prompts."],
  ];
  return (
    <details className="group rounded-lg border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">How Qloo finds these</summary>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map(([title, text], i) => (
          <li key={title} className="grid content-start gap-1 rounded-md bg-muted/50 p-3">
            <span className="font-medium">
              {i + 1}. {title}
            </span>
            <span className="text-muted-foreground">{text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-muted-foreground">
        Each card says why it’s here.{" "}
        <a className="underline underline-offset-2" href="https://github.com/T04435/front-room#the-qloo-calls" target="_blank" rel="noreferrer">
          The Qloo calls, one by one
        </a>
      </p>
    </details>
  );
}

/** A shelf: four at a time (fewer choices with someone waiting), and More for the rest. */
function Shelf({ title, hint, items, onOpen, big, limit = 4, grid }: { title: string; hint?: string; items: GalleryItem[]; onOpen: (g: GalleryItem) => void; big?: boolean; limit?: number; grid?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label={title}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
      <ScrollArea className="w-full whitespace-nowrap">
        {/* Start here: all three in view on a phone, no sideways scroll (QA-44). */}
        {/* Start here's tiles stay about 260px on a wide screen (R2-5). */}
        <ul className={grid ? "grid max-w-[50rem] grid-cols-3 gap-2 p-1 pb-3" : "flex gap-3 p-1 pb-3"}>
          {shown.map((g) => {
            const Icon = ICON[g.type];
            const tag = tagOf(g, true);
            return (
              <li key={g.key} className={cn("shrink-0", grid ? "min-w-0" : big ? "w-52" : "w-44")}>
                <button type="button" onClick={() => onOpen(g)} className="group grid w-full gap-2 rounded-lg text-left whitespace-normal focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label={`${g.title}${g.by ? ` by ${g.by}` : ""}: ${g.type === "place" || g.type === "book" ? "open" : "play"}`}>
                  <span className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg", TILE[g.type])}>
                    <Icon className="size-10 opacity-70" aria-hidden />
                    {g.image && <Art src={g.image} />}
                    <span className={cn("absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full bg-foreground text-background opacity-90 transition-transform group-hover:scale-105", grid && "max-sm:size-8")}>
                      <PlayIcon className="size-5" aria-hidden />
                    </span>
                    {/* Small Start here tiles on a phone: no badge over the picture (QA-68); it's in the sheet. */}
                    {tag && (
                      <Badge className={cn("absolute top-2 left-2 inline-flex max-w-[85%] items-center", grid && "max-sm:hidden")}>
                        <span className="min-w-0 truncate">{tag}</span>
                      </Badge>
                    )}
                  </span>
                  <span className="line-clamp-2 font-medium">{g.title}</span>
                  <span className="line-clamp-1 text-sm text-muted-foreground">{[g.by, g.year].filter(Boolean).join(", ") || (g.type === "place" ? (g.parts.find((x) => !["place", "Qloo", "their story"].includes(x)) ?? "Place") : TYPE_WORD[g.type])}</span>
                  {!grid && <span className="line-clamp-2 text-sm text-muted-foreground">{g.whyShort}</span>}
                </button>
              </li>
            );
          })}
          {items.length > shown.length && (
            <li className={cn("shrink-0", big ? "w-52" : "w-44")}>
              <Button variant="outline" className="aspect-square h-auto w-full flex-col text-base" onClick={() => setAll(true)} aria-label={`More ${title.toLowerCase()}: ${items.length - shown.length} more`}>
                More
                <span className="text-sm text-muted-foreground">{items.length - shown.length} more</span>
              </Button>
            </li>
          )}
        </ul>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

/** "Learned something?" after a play: a name, a place, a job…, saved as staff-heard for the family to confirm in the story chat. */
function LearnedSomething({ person, name, onSaved }: { person: Person; name: string; onSaved: () => void }) {
  // Folded to one line until tapped, so the sheet fits the screen (it read as cut off).
  const [unfolded, setUnfolded] = useState(false);
  const [kind, setKind] = useState<StaffHeard["kind"] | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  async function save() {
    if (!kind || !text.trim()) return;
    setState("saving");
    const heard: StaffHeard = { id: `sh-${Date.now().toString(36)}`, kind, text: text.trim(), at: new Date().toISOString() };
    const res = await fetch(`/api/people/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffHeard: [...person.staffHeard, heard] }) }).catch(() => null);
    if (!res?.ok) return setState("failed");
    setState("saved");
    onSaved();
  }
  if (state === "saved") return <p className="border-t pt-3 text-sm">Noted for {name}&apos;s family to confirm in Tell me more.</p>;
  if (!unfolded)
    return (
      // Never wider than the sheet: it wraps on a phone (R2, last).
      <div className="min-w-0 border-t pt-2">
        <Button variant="ghost" className="-ml-2 h-auto min-h-9 w-full max-w-full justify-start text-left whitespace-normal max-sm:min-h-11" onClick={() => setUnfolded(true)}>
          <Plus aria-hidden /> Learned something new about {name}?
        </Button>
      </div>
    );
  return (
    <div className="grid gap-2 border-t pt-3">
      <span className="text-sm font-medium">Learned something new about {name}?</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="What you learned">
        {HEARD_KINDS.map((k) => (
          <Button key={k} size="sm" className="max-sm:h-10" variant={kind === k ? "default" : "outline"} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {HEARD_LABELS[k]}
          </Button>
        ))}
      </div>
      {kind && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input aria-label="What they said" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={kind === "song" ? "e.g. Hummed Moon River" : "In a few words"} />
          <Button type="submit" disabled={!text.trim() || state === "saving"}>
            Save
          </Button>
        </form>
      )}
      {state === "failed" && <p className="text-sm text-destructive">That didn&apos;t save. Check the connection and tap again.</p>}
    </div>
  );
}

/**
 * Before you start: the 30-second handover for whoever walks in next (an agency carer at 18:00 may not know them).
 * What works, what to avoid, something to talk about, what settles them. The full card is What works.
 */
function Handover({ person, gallery }: { person: Person; gallery: Gallery }) {
  const name = person.preferredName;
  const [mode, setMode] = useCardMode();
  const [more, setMore] = useState(false);
  const visiting = mode === "visit";
  const p = person.practical;
  const works = gallery.works.slice(0, 3).map((g) => (g.by ? `${g.title} (${g.by})` : g.title));
  const avoid = [...person.steers.filter((s) => s.level === "never").map((s) => s.label), ...gallery.paused.map((g) => `‘${g.title}’ (upset) and songs like it, until the family answers`)];
  // Never a moment that touches steer clear: no wedding when the husband is on it (A3). A joyful one first: dancing, work,
  // a place they loved; the wedding only when there's nothing else (UX-10).
  const points = talkingPoints(person);
  const moment = points.find((m) => m.kind !== "wedding") ?? points[0];
  const home = person.places[0];
  const talk = moment ? (moment.kind === "wedding" ? `Their wedding${moment.year ? ` (${moment.year})` : ""}` : moment.label) : home ? `Growing up in ${home.name}` : null;
  const heard = person.staffHeard.filter((h) => h.confirmed).slice(-2).map((h) => h.text);
  const calmSong = calmPick(gallery);
  const settle = [p.calms, calmSong ? `${calmSong.title} (logged calm)` : null].filter(Boolean).join(" · ") || "Not known yet: tap Calm when something helps";
  const rows: [string, string][] = [
    ["Call them", p.greeting ?? name],
    ...(person.languages.length && !person.languages.every((l) => /^english$/i.test(l))
      ? [["Grew up speaking", `${person.languages.join(", ")}.${greetingsIn(person.languages) ? ` A few words in it help: ${greetingsIn(person.languages)}.` : " A few words in it help."}`] as [string, string]]
      : []),
    ["Works", works.length ? works.join(" · ") : "Nothing proven yet: start with the family's picks"],
    ["Avoid", avoid.length ? avoid.join(" · ") : person.steerAsked ? "Nothing flagged" : "Not asked yet"],
    ...(talk ? [["Talk about", talk] as [string, string]] : []),
    ["Calm with", settle],
    ["First", `Comfortable, no pain, been to the toilet, not too hot or cold · a quiet room · ${p.headphonesOk === true ? "headphones are fine" : p.headphonesOk === false ? "no headphones" : "headphones only if you know they're OK"}`],
    ...(heard.length ? [["Staff heard", heard.join(" · ")] as [string, string]] : []),
    // "No headphones" is already in First (UX-9).
    ...(p.hearing ? [["Hearing", p.hearing] as [string, string]] : []),
    ...(p.bestTime && !visiting ? [["Best time", p.bestTime] as [string, string]] : []),
    ...(visiting ? [["If words are hard", "Sit close, hum along, hold a hand if they like that."] as [string, string]] : []),
  ];
  // A family visit: the best time comes first.
  if (visiting && p.bestTime) rows.unshift(["Best time", p.bestTime]);
  // On a phone, the four that matter most; the rest behind More (UX-1).
  const core = new Set(["Call them", "Avoid", "Calm with", "First"]);
  const extra = rows.filter(([k]) => !core.has(k)).length;
  return (
    <Card size="sm" aria-label={visiting ? "Before you visit" : "Before you start"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
          {visiting ? "Before you visit" : "Before you start"}
          <span className="flex rounded-lg border p-0.5 font-sans text-xs font-normal" role="group" aria-label="Who this card is for">
            {(["staff", "visit"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("min-h-9 rounded-md px-3 py-1 max-sm:min-h-11", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {m === "staff" ? "For staff" : "For a visit"}
              </button>
            ))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-base">
          {rows.map(([k, v]) => (
            <div key={k} className={cn("contents", !core.has(k) && !more && "max-sm:hidden")}>
              <dt className="text-muted-foreground">{k}</dt>
              {/* Avoid is said by the word and an icon, not red (UX-6). */}
              <dd className={k === "Avoid" && avoid.length ? "flex items-start gap-1.5 font-medium text-primary" : undefined}>
                {k === "Avoid" && avoid.length > 0 && <Ban aria-hidden className="mt-1 size-4 shrink-0" />}
                <span>{v}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {extra > 0 && (
            <button type="button" className="min-h-11 text-sm underline underline-offset-4 sm:hidden" aria-expanded={more} onClick={() => setMore((x) => !x)}>
              {more ? "Less" : `More (${extra})`}
            </button>
          )}
          <Link href={`/p/${person.id}/works`} className="inline-block py-2 text-sm underline underline-offset-4">
            What works
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A tile's picture (Qloo's artist photo, poster or place image), over the icon: if it fails to load it hides, and the
 * icon shows. Remote images from Qloo's CDN, so a plain img.
 */
function Art({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote art from Qloo's CDN, many sizes; no optimisation needed.
    <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="absolute inset-0 size-full rounded-[inherit] object-cover" />
  );
}

/** "Hello" and "thank you" in the languages families name most, for the handover card; nothing for one we don't know. */
const GREETINGS: Record<string, string> = {
  spanish: "hola, gracias",
  español: "hola, gracias",
  punjabi: "sat sri akal, dhanvaad",
  urdu: "assalam-o-alaikum, shukriya",
  welsh: "shwmae, diolch",
  gaelic: "halò, tapadh leat",
  polish: "dzień dobry, dziękuję",
  "jamaican patois": "wah gwaan, tanks",
  italian: "ciao, grazie",
  portuguese: "olá, obrigado",
  irish: "dia duit, go raibh maith agat",
  bengali: "nomoshkar, dhonnobad",
  gujarati: "kem cho, aabhar",
  hindi: "namaste, dhanyavaad",
  cantonese: "nei hou, m̀h gōi",
  greek: "yia sou, efharistó",
};
function greetingsIn(languages: string[]): string | null {
  const l = languages.find((x) => !/^english/i.test(x));
  return l ? (GREETINGS[l.toLowerCase().trim()] ?? null) : null;
}
