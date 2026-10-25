import { filmSong, hookFor, inStory, isGentle, isHarsh, isInstitution, promptFor, steerRulesOutHarsh, type Prompt } from "./card-words";
import { searchLinks } from "./kit";
import { itemKey, type ItemStat } from "./learning";
import { steersClear, type Person, type Suggestion } from "./person";

export type GalleryType = "song" | "film" | "tv" | "book" | "place";

/** One thing in a person's gallery: from Qloo or from the family, with how it's gone so far. */
export type GalleryItem = {
  key: string;
  type: GalleryType;
  title: string;
  by?: string;
  year: number | null;
  /** Source line: "60s · Manchester · Qloo", "the family". */
  parts: string[];
  source: string;
  origin: "family" | "qloo" | "new_try";
  like?: string;
  /** The Qloo suggestion behind it, for the family's quick answer. */
  cardId?: string;
  answer?: Suggestion["answer"];
  stat?: ItemStat;
  placeId?: string;
  genres?: string[];
  /** The story mentions it ("Danced at the Ritz"). */
  story?: string;
  /** What the card says to the carer: tied to the person, and one open prompt. */
  hook: string;
  prompt: Prompt;
  /** Where to play or see it: we host nothing. */
  links: { label: string; href: string }[];
};

export const TYPE_WORD: Record<GalleryType, string> = { song: "Song", film: "Film", tv: "TV", book: "Book", place: "Place" };

const q = encodeURIComponent;
export function linksFor(type: GalleryType, title: string, by?: string, year?: number | null): GalleryItem["links"] {
  if (type === "song") {
    const l = searchLinks(by ?? "", title);
    return [
      { label: "Spotify", href: l.spotify },
      { label: "YouTube", href: l.youtube },
    ];
  }
  // Nobody watches a whole film at the bedside: a song from it, or the theme tune, then a clip.
  const yt = (s: string) => `https://www.youtube.com/results?search_query=${q(s)}`;
  if (type === "film") {
    const song = filmSong(title);
    return [song ? { label: `Play “${song}”`, href: yt(`${song} ${title}`) } : { label: "Songs from it", href: yt(`${title} ${year ?? ""} soundtrack`) }, { label: "A clip", href: yt(`${title} ${year ?? ""} clip`) }];
  }
  if (type === "tv") return [{ label: "Play the theme", href: yt(`${title} theme tune`) }, { label: "A clip", href: yt(`${title} ${year ?? ""} clip`) }];
  if (type === "book") return [{ label: "Find it", href: `https://openlibrary.org/search?q=${q(`${title} ${by ?? ""}`)}` }];
  return [{ label: "Photos", href: `https://www.google.com/search?tbm=isch&q=${q(title)}` }];
}

export type Gallery = {
  /** Proven: what works for them, best first. */
  works: GalleryItem[];
  shelves: Record<GalleryType, GalleryItem[]>;
  newTries: GalleryItem[];
  paused: GalleryItem[];
  resting: GalleryItem[];
  total: number;
};

/**
 * A person's gallery: everything Qloo suggested for their places and years, what the family said they love, and new
 * tries like what works. Never anything they should steer clear of, or that the family said is not for them. Paused
 * (after an upset) and resting (no reaction three times) items stay out of the shelves.
 */
export function galleryOf(p: Person, stats: Map<string, ItemStat>): Gallery {
  const items = new Map<string, GalleryItem>();
  const noHarsh = steerRulesOutHarsh(p);
  const put = (g: Omit<GalleryItem, "key" | "links" | "stat" | "hook" | "prompt">) => {
    const key = itemKey({ type: g.type, title: g.title, by: g.by });
    if (items.has(key) || steersClear(p, g.title, g.by)) return;
    const family = g.origin === "family";
    // War, crime and the like go when steer clear points that way (the family's own picks stay); so do institutions.
    if (!family && (g.type === "film" || g.type === "tv") && noHarsh && isHarsh(g.genres)) return;
    if (!family && g.type === "place" && isInstitution(g.title)) return;
    const story = inStory(p, g.title) ?? undefined;
    items.set(key, { ...g, key, story, links: linksFor(g.type, g.title, g.by, g.year), stat: stats.get(key), hook: story ? `From ${p.preferredName || "their"}’s story: ${story}.` : hookFor(p, g), prompt: promptFor(g.type, g.title) });
  };
  // The family's own loves first.
  for (const l of p.loves) {
    if (l.source === "ring_a_bell") continue;
    if ((l.type === "song" && l.by) || l.type === "film" || l.type === "tv" || l.type === "book" || l.type === "place") {
      put({ type: l.type, title: l.title, by: l.by, year: l.year ?? null, parts: ["the family"], source: "The family said they love it.", origin: "family" });
    }
  }
  for (const [k, cards] of Object.entries(p.suggestions)) {
    for (const c of cards) {
      if (c.answer === "upset" || c.type === "artist") continue;
      put({ type: c.type, title: c.title, by: c.by, year: c.year, parts: c.parts, source: c.source, origin: k === "new-tries" ? "new_try" : k === "family" ? "family" : "qloo", like: c.like, cardId: c.id, answer: c.answer, placeId: c.placeId, genres: c.genres });
    }
  }
  const all = [...items.values()];
  const state = (g: GalleryItem) => g.stat?.state;
  const live = all.filter((g) => state(g) !== "paused" && state(g) !== "resting");
  // The family's picks and the story first; gentle films before harsh ones.
  const score = (g: GalleryItem) =>
    (g.answer === "yes" || g.origin === "family" ? 50 : 0) + (g.story ? 40 : 0) + (isHarsh(g.genres) ? -30 : isGentle(g.genres) ? 5 : 0) + (g.stat?.sangSessions ?? 0) * 3 + (g.stat?.engagedSessions ?? 0) * 2 + (g.stat?.calmSessions ?? 0);
  const shelf = (t: GalleryType) => live.filter((g) => g.type === t && g.origin !== "new_try").sort((a, b) => score(b) - score(a));
  return {
    works: live.filter((g) => state(g) === "proven").sort((a, b) => score(b) - score(a)),
    shelves: { song: shelf("song"), film: shelf("film"), tv: shelf("tv"), book: shelf("book"), place: shelf("place") },
    newTries: live.filter((g) => g.origin === "new_try"),
    paused: all.filter((g) => state(g) === "paused"),
    resting: all.filter((g) => state(g) === "resting"),
    total: all.length,
  };
}

/**
 * Something to settle them now (Stop, or "Something calm now"): only a song staff have logged Calm with, most calm
 * days first. No evidence, no pick: the card says it's not known yet rather than guess. Never the item just stopped.
 */
export function calmPick(g: Gallery, except?: string): GalleryItem | null {
  const all = [...g.works, ...Object.values(g.shelves).flat(), ...g.newTries];
  const calm = all.filter((x) => x.type === "song" && x.key !== except && (x.stat?.calmSessions ?? 0) > 0);
  return calm.sort((a, b) => (b.stat?.calmSessions ?? 0) - (a.stat?.calmSessions ?? 0))[0] ?? null;
}
