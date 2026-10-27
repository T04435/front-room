"use client";

import { BookOpen, Check, Droplet, Plus, ExternalLink, Eye, Film, Heart, MapPin, MessageCircleHeart, Music, OctagonX, Play as PlayIcon, Sparkles, ThumbsDown, TriangleAlert, Tv, Undo2, Waves } from "lucide-react";
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
import { calmPick, TYPE_WORD, type Gallery, type GalleryItem, type GalleryType } from "@/lib/gallery";
import { RESPONSE_LABELS, RESPONSES } from "@/lib/kit";
import type { Play } from "@/lib/learning";
import { HEARD_KINDS, type Person, type StaffHeard } from "@/lib/person";
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
const LOG_ICON = { calm: Waves, engaged: Eye, sang: Music, tearful: Droplet, upset: TriangleAlert } as const;
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
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** A small tag on a tile: why it's here, or how it's gone. */
function tagOf(g: GalleryItem): string | null {
  if (g.askFamily) return "Ask family";
  if (g.stat?.state === "proven") return g.stat.sangSessions >= 2 ? "Sings along" : "Works";
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
  const startHere = [
    gallery.works[0] ?? gallery.shelves.song.find((g) => g.origin === "family") ?? gallery.shelves.song[0],
    gallery.newTries[0],
    gallery.shelves.place.find((g) => g.story) ?? gallery.shelves.film[0] ?? gallery.shelves.place[0],
  ].filter((g, i, xs): g is GalleryItem => Boolean(g) && xs.findIndex((x) => x?.key === g?.key) === i);
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
    if (!res.ok) return setNotice(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save.");
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
    const calm = calmPick(gallery, g.key);
    setOpen(calm ?? null, true);
    if (calm) setNotice(`Stopped and logged as upset. Something that has calmed ${name}: ${calm.title}.`);
    else setStopped(`Stopped and logged as upset. Nothing has been logged calm for ${name} yet: take a break, and first check the basics (pain, hungry or thirsty, the toilet, too hot or cold). Sit with them quietly.`);
  }

  async function answer(g: GalleryItem, a: "yes" | "upset") {
    if (ro || !g.cardId) return;
    setBusy(g.key);
    const res = await fetch(`/api/people/${person.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card: g.cardId, answer: g.answer === a ? null : a }) });
    setBusy(null);
    if (!res.ok) return setNotice("That didn't save.");
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
            <p className="text-muted-foreground">Things to play and talk about with {name}, from their life and places. Tap one to play it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="max-sm:h-11">
              <Link href={`/p/${person.id}/story`}>
                <MessageCircleHeart aria-hidden /> Get to know {name} better
              </Link>
            </Button>
            <Button asChild variant="ghost" className="max-sm:h-11">
              <Link href={`/p/${person.id}/works`}>What works</Link>
            </Button>
            {calmPick(gallery) && (
              <Button variant="secondary" className="max-sm:h-11" onClick={() => setOpen(calmPick(gallery), true)}>
                <Waves aria-hidden /> Something calm now
              </Button>
            )}
          </div>
        </div>
        {ro ? (
          <Alert>
            <AlertDescription>A fictional person with five days of play, so you can see what works rise to the top. Read-only: add your own person to play and log.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CopyLink path={`/p/${person.id}`} /> Anyone with this link can see and add to {name}&apos;s page.
          </div>
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
        <Alert role="status" className="fixed inset-x-4 bottom-4 z-50 shadow-lg sm:mx-auto sm:max-w-xl">
          <Waves />
          <AlertDescription className="flex flex-wrap items-start justify-between gap-2">
            <span>{stopped}</span>
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
      {gallery.newTries.length > 0 && <Shelf title="New tries" hint={gallery.works.length ? "Like what works for them" : "Like what the family says they love"} items={gallery.newTries} onOpen={setOpen} />}
      {findingTries && gallery.newTries.length === 0 && <p className="text-sm text-muted-foreground">Finding new tries like what {gallery.works.length ? `works for ${name}` : `${name} loves`}…</p>}
      {(["song", "film", "tv", "book", "place"] as const).map((t) => (gallery.shelves[t].length ? <Shelf key={t} title={SHELF[t]} items={gallery.shelves[t]} onOpen={setOpen} /> : null))}

      {(gallery.paused.length > 0 || gallery.resting.length > 0) && (
        <section className="grid gap-1 text-sm text-muted-foreground">
          {gallery.paused.length > 0 && <p>Paused after an upset: {gallery.paused.map((g) => g.title).join(", ")}. The family is asked about it in Get to know them better.</p>}
          {gallery.resting.length > 0 && <p>Resting for a month (no reaction three times): {gallery.resting.map((g) => g.title).join(", ")}.</p>}
        </section>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && (setOpen(null), setNotice(null))}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto sm:mx-auto sm:max-w-xl sm:rounded-t-xl"
          onCloseAutoFocus={(e) => {
            if (!opener.current?.isConnected) return;
            e.preventDefault();
            opener.current.focus();
          }}
        >
          {open && (
            <div className="grid gap-3 px-4 pb-4">
              {settling && (
                <Alert className="mt-8 max-sm:mt-12">
                  <Waves />
                  <AlertDescription>First, the basics: are they in pain, hungry or thirsty, needing the toilet, too hot or cold? Then try this, softly, and sit with them.</AlertDescription>
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
              <p className="font-mono text-xs text-muted-foreground" title={open.source}>
                {open.parts.join(" · ")}
              </p>

              <div className="grid gap-2">
                <span className="text-sm font-medium">How did {name} respond?</span>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Log a response">
                  {/* "Sang along" fits songs and the telly (music shows), not a place or a book. */}
                  {RESPONSES.filter((r) => r !== "sang" || open.type === "song" || open.type === "tv").map((r) => {
                    const Icon = LOG_ICON[r];
                    const on = mine.some((p) => p.response === r);
                    return (
                      <Button key={r} variant={on ? "default" : "outline"} className="h-12 justify-start text-base" disabled={ro} aria-pressed={on} onClick={() => void log(open, r)}>
                        {on ? <Check aria-hidden /> : <Icon aria-hidden className={r === "upset" ? "text-destructive" : undefined} />} {RESPONSE_LABELS[r]}
                      </Button>
                    );
                  })}
                </div>
                <p aria-live="polite" className="flex min-h-6 flex-wrap items-center gap-2 text-sm">
                  {notice ??
                    (mine.length ? (
                      <>
                        Logged: {RESPONSE_LABELS[mine.at(-1)!.response]} · {hm(mine.at(-1)!.at)}
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
                <Button variant="destructive" className="h-12" disabled={ro} onClick={() => void stop(open)}>
                  <OctagonX aria-hidden /> Stop · something calm instead
                </Button>
              </div>

              {mine.length > 0 && !ro && <LearnedSomething key={open.key} person={person} name={name} onSaved={() => router.refresh()} />}

              {open.cardId && !ro && open.origin !== "family" && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">From Qloo for their years.</span>
                  <Button size="sm" variant={open.answer === "yes" ? "default" : "outline"} disabled={busy === open.key} onClick={() => void answer(open, "yes")}>
                    <Heart aria-hidden /> Loved it
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === open.key} onClick={() => void answer(open, "upset")}>
                    <ThumbsDown aria-hidden /> Not for them
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
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
        <ul className={grid ? "grid grid-cols-3 gap-2 p-1 pb-3" : "flex gap-3 p-1 pb-3"}>
          {shown.map((g) => {
            const Icon = ICON[g.type];
            const tag = tagOf(g);
            return (
              <li key={g.key} className={cn("shrink-0", grid ? "min-w-0" : big ? "w-52" : "w-44")}>
                <button type="button" onClick={() => onOpen(g)} className="group grid w-full gap-2 rounded-lg text-left whitespace-normal focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label={`${g.title}${g.by ? ` by ${g.by}` : ""}: ${g.type === "place" || g.type === "book" ? "open" : "play"}`}>
                  <span className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg", TILE[g.type])}>
                    <Icon className="size-10 opacity-70" aria-hidden />
                    {g.image && <Art src={g.image} />}
                    <span className="absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full bg-foreground text-background opacity-90 transition-transform group-hover:scale-105">
                      <PlayIcon className="size-5" aria-hidden />
                    </span>
                    {tag && <Badge className="absolute top-2 left-2 block max-w-[85%] justify-start truncate">{tag}</Badge>}
                  </span>
                  <span className="line-clamp-2 font-medium">{g.title}</span>
                  <span className="line-clamp-1 text-sm text-muted-foreground">{[g.by, g.year].filter(Boolean).join(", ") || (g.type === "place" ? (g.parts.find((x) => !["place", "Qloo"].includes(x)) ?? "Place") : TYPE_WORD[g.type])}</span>
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
  if (state === "saved") return <p className="border-t pt-3 text-sm">Noted for {name}&apos;s family to confirm in Get to know them better.</p>;
  if (!unfolded)
    return (
      <div className="border-t pt-2">
        <Button variant="ghost" className="max-sm:h-11 -ml-2" onClick={() => setUnfolded(true)}>
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
      {state === "failed" && <p className="text-sm text-destructive">That didn&apos;t save. Try again.</p>}
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
  const visiting = mode === "visit";
  const p = person.practical;
  const works = gallery.works.slice(0, 3).map((g) => (g.by ? `${g.title} (${g.by})` : g.title));
  const avoid = [...person.steers.filter((s) => s.level === "never").map((s) => s.label), ...gallery.paused.map((g) => `${g.title} (upset)`)];
  const moment = person.moments[0];
  const home = person.places[0];
  const talk = moment ? (moment.kind === "wedding" ? `Their wedding${moment.year ? ` (${moment.year})` : ""}` : moment.label) : home ? `Growing up in ${home.name}` : null;
  const heard = person.staffHeard.filter((h) => h.confirmed).slice(-2).map((h) => h.text);
  const calmSong = calmPick(gallery);
  const settle = [p.calms, calmSong ? `${calmSong.title} (logged calm)` : null].filter(Boolean).join(" · ") || "Not known yet: tap Calm when something helps";
  const rows: [string, string][] = [
    ["Call them", p.greeting ?? name],
    ...(person.languages.length && !person.languages.every((l) => /^english$/i.test(l))
      ? [["Grew up speaking", `${person.languages.join(", ")}. A few words in it help: hello, thank you.`] as [string, string]]
      : []),
    ["Works", works.length ? works.join(" · ") : "Nothing proven yet: start with the family's picks"],
    ["Avoid", avoid.length ? avoid.join(" · ") : person.steerAsked ? "Nothing flagged" : "Not asked yet"],
    ...(talk ? [["Talk about", talk] as [string, string]] : []),
    ["Calm with", settle],
    ["First", `Comfortable, no pain, been to the toilet, not too hot or cold · a quiet room · ${p.headphonesOk === true ? "headphones are fine" : p.headphonesOk === false ? "no headphones" : "headphones only if you know they're OK"}`],
    ...(heard.length ? [["Staff heard", heard.join(" · ")] as [string, string]] : []),
    ...(p.hearing ? [["Hearing", `${p.hearing}${p.headphonesOk === false ? "; no headphones" : ""}`] as [string, string]] : []),
    ...(p.bestTime && !visiting ? [["Best time", p.bestTime] as [string, string]] : []),
    ...(visiting ? [["If words are hard", "Sit close, hum along, hold a hand if they like that."] as [string, string]] : []),
  ];
  // A family visit: the best time comes first.
  if (visiting && p.bestTime) rows.unshift(["Best time", p.bestTime]);
  return (
    <Card size="sm" aria-label={visiting ? "Before you visit" : "Before you start"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
          {visiting ? "Before you visit" : "Before you start"}
          <span className="flex rounded-lg border p-0.5 font-sans text-xs font-normal" role="group" aria-label="Who this card is for">
            {(["staff", "visit"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-md px-2.5 py-1 max-sm:min-h-10", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {m === "staff" ? "For staff" : "For a visit"}
              </button>
            ))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={k === "Avoid" && avoid.length ? "font-medium text-destructive" : undefined}>{v}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/p/${person.id}/works`} className="mt-1 inline-block py-2 text-sm underline underline-offset-4">
          The full handover card
        </Link>
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
