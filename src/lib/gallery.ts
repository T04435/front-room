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
  if (type === "film" || type === "tv") return [{ label: "Clips on YouTube", href: `https://www.youtube.com/results?search_query=${q(`${title} ${year ?? ""} clip`)}` }];
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
  const put = (g: Omit<GalleryItem, "key" | "links" | "stat">) => {
    const key = itemKey({ type: g.type, title: g.title, by: g.by });
    if (items.has(key) || steersClear(p, g.title, g.by)) return;
    items.set(key, { ...g, key, links: linksFor(g.type, g.title, g.by, g.year), stat: stats.get(key) });
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
      put({ type: c.type, title: c.title, by: c.by, year: c.year, parts: c.parts, source: c.source, origin: k === "new-tries" ? "new_try" : "qloo", like: c.like, cardId: c.id, answer: c.answer });
    }
  }
  const all = [...items.values()];
  const state = (g: GalleryItem) => g.stat?.state;
  const live = all.filter((g) => state(g) !== "paused" && state(g) !== "resting");
  const score = (g: GalleryItem) => (g.answer === "yes" || g.origin === "family" ? 50 : 0) + (g.stat?.sangSessions ?? 0) * 3 + (g.stat?.engagedSessions ?? 0) * 2 + (g.stat?.calmSessions ?? 0);
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
