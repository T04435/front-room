"use client";

import { BookOpen, Check, ExternalLink, Eye, Film, Heart, MapPin, MessageCircleHeart, Music, OctagonX, Play as PlayIcon, Sparkles, ThumbsDown, TriangleAlert, Tv, Undo2, Waves } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CopyLink } from "@/components/person-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TYPE_WORD, type Gallery, type GalleryItem, type GalleryType } from "@/lib/gallery";
import { RESPONSE_LABELS, RESPONSES } from "@/lib/kit";
import type { Play } from "@/lib/learning";
import type { Person } from "@/lib/person";
import { cn } from "@/lib/utils";

const ICON: Record<GalleryType, typeof Music> = { song: Music, film: Film, tv: Tv, book: BookOpen, place: MapPin };
const TILE: Record<GalleryType, string> = {
  song: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  film: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  tv: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  book: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  place: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
};
const SHELF: Record<GalleryType, string> = { song: "Songs", film: "Films", tv: "On the telly", book: "Books", place: "Places they knew" };
const LOG_ICON = { calm: Waves, engaged: Eye, sang: Music, upset: TriangleAlert } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** A small tag on a tile: why it's here, or how it's gone. */
function tagOf(g: GalleryItem): string | null {
  if (g.stat?.state === "proven") return g.stat.sangSessions >= 2 ? "Sings along" : "Works";
  if (g.origin === "new_try") return g.like ? `New try · like ${g.like}` : "New try";
  if (g.answer === "yes") return "Loved it";
  if (g.origin === "family") return "From the family";
  if (g.stat?.state === "tried") return "Tried";
  return null;
}

/**
 * A person's gallery: what to play for them right now. Spotify and Netflix in one: shelves of songs, films, TV, books
 * and places from Qloo for their life and places, and what the family said they love. Tap one to play it (Spotify,
 * YouTube; nothing hosted here) and log how it went; the gallery learns from it.
 */
export function GalleryView({ person, gallery, plays, stale, triesDue }: { person: Person; gallery: Gallery; plays: Play[]; stale: boolean; triesDue: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const [logged, setLogged] = useState<Play[]>(plays);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ro = Boolean(person.example);
  const name = person.preferredName;
  const [findingTries, setFindingTries] = useState(triesDue);
  const [since] = useState(() => new Date().toISOString());

  // What works changed since the new tries were found: find new ones like it, quietly, then show them.
  useEffect(() => {
    if (!triesDue) return;
    let live = true;
    fetch(`/api/people/${person.id}/new-tries`, { method: "POST" })
      .then((r) => r.json())
      .then((b: { changed?: boolean }) => live && b.changed && router.refresh())
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
    const calm =
      gallery.works.find((w) => w.key !== g.key && w.type === "song" && (w.stat?.calmSessions ?? 0) > 0) ??
      gallery.works.find((w) => w.key !== g.key && w.type === "song") ??
      gallery.shelves.song.find((w) => w.key !== g.key && w.origin === "family");
    setOpen(calm ?? null);
    setNotice(calm ? `Stopped and logged as upset. Something calm instead: ${calm.title}.` : "Stopped and logged as upset. Take a break.");
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
    <div className="grid gap-8">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-3xl font-semibold">{name}</h1>
            <p className="text-muted-foreground">Things to play and talk about with {name}, from their life and places. Tap one to play it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/p/${person.id}/story`}>
                <MessageCircleHeart aria-hidden /> Get to know {name} better
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/p/${person.id}/works`}>What works</Link>
            </Button>
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

      {gallery.works.length > 0 && <Shelf title={`Works for ${name}`} hint="Sang along or engaged on two days" items={gallery.works} onOpen={setOpen} big />}
      {gallery.newTries.length > 0 && <Shelf title="New tries" hint="Like what works for them" items={gallery.newTries} onOpen={setOpen} />}
      {findingTries && gallery.newTries.length === 0 && <p className="text-sm text-muted-foreground">Finding new tries like what works for {name}…</p>}
      {(["song", "film", "tv", "book", "place"] as const).map((t) => (gallery.shelves[t].length ? <Shelf key={t} title={SHELF[t]} items={gallery.shelves[t]} onOpen={setOpen} /> : null))}

      {(gallery.paused.length > 0 || gallery.resting.length > 0) && (
        <section className="grid gap-1 text-sm text-muted-foreground">
          {gallery.paused.length > 0 && <p>Paused after an upset: {gallery.paused.map((g) => g.title).join(", ")}. The family is asked about it in Get to know them better.</p>}
          {gallery.resting.length > 0 && <p>Resting for a month (no reaction three times): {gallery.resting.map((g) => g.title).join(", ")}.</p>}
        </section>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && (setOpen(null), setNotice(null))}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto sm:mx-auto sm:max-w-xl sm:rounded-t-xl">
          {open && (
            <div className="grid gap-4 px-4 pb-6">
              <SheetHeader className="px-0">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {TYPE_WORD[open.type]}
                  {tagOf(open) && <Badge variant="secondary">{tagOf(open)}</Badge>}
                </span>
                <SheetTitle className="text-3xl leading-tight">{open.title}</SheetTitle>
                <SheetDescription className="text-lg">{[open.by, open.year].filter(Boolean).join(", ")}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-wrap gap-2">
                {open.links.map((l, i) => (
                  <Button key={l.href} asChild variant={i === 0 ? "default" : "outline"}>
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {i === 0 ? <PlayIcon aria-hidden /> : <ExternalLink aria-hidden />} {l.label}
                    </a>
                  </Button>
                ))}
              </div>
              <p className="font-mono text-xs text-muted-foreground" title={open.source}>
                {open.parts.join(" · ")}
              </p>

              <div className="grid gap-2">
                <span className="text-sm font-medium">How did {name} respond?</span>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Log a response">
                  {RESPONSES.map((r) => {
                    const Icon = LOG_ICON[r];
                    const on = mine.some((p) => p.response === r);
                    return (
                      <Button key={r} variant={on ? "default" : "outline"} className="h-14 justify-start text-base" disabled={ro} aria-pressed={on} onClick={() => void log(open, r)}>
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
                        <Button size="xs" variant="ghost" onClick={() => void undo(mine.at(-1)!)}>
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

              {open.cardId && !ro && (
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

function Shelf({ title, hint, items, onOpen, big }: { title: string; hint?: string; items: GalleryItem[]; onOpen: (g: GalleryItem) => void; big?: boolean }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
      <ScrollArea className="w-full whitespace-nowrap">
        <ul className="flex gap-3 pb-3">
          {items.map((g) => {
            const Icon = ICON[g.type];
            const tag = tagOf(g);
            return (
              <li key={g.key} className={cn("shrink-0", big ? "w-52" : "w-44")}>
                <button type="button" onClick={() => onOpen(g)} className="group grid w-full gap-2 rounded-lg text-left whitespace-normal focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label={`${g.title}${g.by ? ` by ${g.by}` : ""}: play`}>
                  <span className={cn("relative flex aspect-square w-full items-center justify-center rounded-lg", TILE[g.type])}>
                    <Icon className="size-10 opacity-70" aria-hidden />
                    <span className="absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full bg-foreground text-background opacity-90 transition-transform group-hover:scale-105">
                      <PlayIcon className="size-5" aria-hidden />
                    </span>
                    {tag && <Badge className="absolute top-2 left-2 block max-w-[85%] justify-start truncate">{tag}</Badge>}
                  </span>
                  <span className="line-clamp-2 font-medium">{g.title}</span>
                  <span className="line-clamp-1 text-sm text-muted-foreground">{[g.by, g.year].filter(Boolean).join(", ") || TYPE_WORD[g.type]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
