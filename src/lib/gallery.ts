import { filmSong, historicName, hookFor, inStory, isGentle, isHarsh, isInstitution, promptFor, steerRulesOutHarsh, whyFor, whyShort, youthRun, type Prompt } from "./card-words";
import { searchLinks } from "./kit";
import { itemKey, type ItemStat } from "./learning";
import { steersClear, type Person, type Suggestion } from "./person";
import { nameKey } from "./qloo-parse";

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
  image?: string;
  /** Tearful with it, and the family hasn't said keep it or steer clear yet. */
  askFamily?: boolean;
  /** The story mentions it ("Danced at the Ritz"). */
  story?: string;
  /** Found on Qloo because the story names it (A6: only these, and the family's own, say "From their story"). */
  fromStory?: string;
  /** Films and TV: Qloo's popularity, so the familiar lead (IM-4). TV: the last year of its run (IM-3). */
  popularity?: number;
  runTo?: number;
  /** A stand-in for this love of theirs Qloo couldn't find (IM-5). */
  standIn?: string;
  /** A new try seeded by something proven: "Because ‘Waterloo’ worked" (IM-2). */
  worked?: boolean;
  /** Why it's here, plainly (A8): what Qloo matched, or that the family named it; and the same in a few words. */
  why: string;
  whyShort: string;
  /** What the card says to the carer: tied to the person, and one open prompt. */
  hook: string;
  prompt: Prompt;
  /** Where to play or see it: we host nothing. */
  links: { label: string; href: string }[];
};

/** Stand-ins for loves Qloo couldn't find (IM-5): new tries, until a log proves one. */
export const STAND_INS_KEY = "stand-ins";

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

/** Places of everyday life: dance halls, cinemas, theatres, grounds, markets, piers, parks, towers, stations, shops. */
const EVERYDAY = /ballroom|dance|cinema|picture|theatre|palace|ground|football|market|pier|park|tower|pleasure|station|store|club|empire|hall\b|gardens/i;

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
  const towns = p.places.map((x) => nameKey(x.name)).filter(Boolean);
  // One card per place (FC-4): "the Cavern Liverpool" and "The Cavern Club" are the same place.
  const placeKey = (title: string) => {
    let k = ` ${nameKey(title)} `.replace(/^ the /, " ");
    for (const t of towns) k = k.replace(new RegExp(` ${t} $`), " ");
    return k;
  };
  const samePlace = (a: string, b: string) => {
    const [x, y] = [placeKey(a), placeKey(b)];
    return x.trim().length > 0 && y.trim().length > 0 && (x.startsWith(y) || y.startsWith(x));
  };
  // What's proven, and what's paused after an upset or a Stop (IM-1, IM-2), by name.
  const proven = new Set([...stats.values()].filter((s) => s.state === "proven").map((s) => nameKey(s.title)));
  const paused = new Set([...stats.values()].filter((s) => s.state === "paused").flatMap((s) => [nameKey(s.title), ...(s.by ? [nameKey(s.by)] : [])]));
  const put = (input: Omit<GalleryItem, "key" | "links" | "stat" | "hook" | "prompt" | "why" | "whyShort">) => {
    let g = input.type === "place" ? { ...input, title: input.title.replace(/^the /, "The ") } : input;
    if (g.type === "place") {
      const twin = [...items.values()].find((x) => x.type === "place" && samePlace(x.title, g.title));
      if (twin) {
        // Keep the fuller name ("The Cavern Club"), and the story's words from either.
        const [keep, drop] = placeKey(twin.title).length >= placeKey(g.title).length ? [twin, g] : [g, twin];
        items.delete(twin.key);
        g = { ...keep, origin: twin.origin === "family" || g.origin === "family" ? "family" : keep.origin, fromStory: keep.fromStory ?? drop.fromStory };
      }
    }
    const key = itemKey({ type: g.type, title: g.title, by: g.by });
    // A steer-clear can name a genre or keyword too ("Boxing" against Rocky's).
    if (items.has(key) || steersClear(p, g.title, g.by, ...(g.origin === "family" ? [] : (g.genres ?? [])))) return;
    const family = g.origin === "family";
    // War, crime and the like go when steer clear points that way (the family's own picks stay); so do institutions.
    if (!family && (g.type === "film" || g.type === "tv") && noHarsh && isHarsh(g.genres)) return;
    if (!family && g.type === "place" && isInstitution(g.title)) return;
    // Sound-alikes follow an upset (IM-1): a new try found like something paused waits until the family answers.
    if (g.origin === "new_try" && g.like && paused.has(nameKey(g.like))) return;
    if (g.origin === "new_try" && g.like && proven.has(nameKey(g.like))) g = { ...g, worked: true };
    // The story's words go only on what the story names: a venue found for it, or a Qloo place the family mentioned
    // (the Ritz). Never a song that shares a word with it ("Dancing Queen" and "went dancing": A6).
    const story = g.fromStory ?? (g.type === "place" ? (inStory(p, g.title) ?? undefined) : undefined);
    const st = stats.get(key);
    const askFamily = Boolean(st && st.tearfulSessions > 0 && st.state !== "paused" && !p.resolvedUpsets.includes(key));
    items.set(key, { ...g, key, story, askFamily, links: linksFor(g.type, g.title, g.by, g.year), stat: stats.get(key), hook: story ? `From ${p.preferredName || "their"}’s story: ${story}.` : hookFor(p, g), prompt: promptFor(g.type, g.title), why: whyFor(p, { ...g, story }), whyShort: whyShort(p, { ...g, fromStory: g.fromStory ?? story }) });
  };
  // The family's own loves first.
  for (const l of p.loves) {
    if (l.source === "ring_a_bell") continue;
    if ((l.type === "song" && l.by) || l.type === "film" || l.type === "tv" || l.type === "book" || l.type === "place") {
      put({ type: l.type, title: l.title, by: l.by, year: l.year ?? null, parts: ["the family"], source: "The family said they love it.", origin: "family", ...(l.image ? { image: l.image } : {}) });
    }
  }
  for (const [k, cards] of Object.entries(p.suggestions)) {
    for (const c of cards) {
      if (c.answer === "upset" || c.type === "artist") continue;
      // Places by their own name, not today's sponsor's (A12).
      put({ type: c.type, title: c.type === "place" ? historicName(c.title) : c.title, by: c.by, year: c.year, parts: c.parts, source: c.source, origin: k === "new-tries" || k === STAND_INS_KEY ? "new_try" : k === "family" ? "family" : "qloo", like: c.like, cardId: c.id, answer: c.answer, placeId: c.placeId, genres: c.genres, image: c.image, ...(c.fromStory ? { fromStory: c.fromStory } : {}), ...(c.popularity !== undefined ? { popularity: c.popularity } : {}), ...(c.runTo ? { runTo: c.runTo } : {}), ...(c.standIn ? { standIn: c.standIn } : {}) });
    }
  }
  const all = [...items.values()];
  const state = (g: GalleryItem) => g.stat?.state;
  const live = all.filter((g) => state(g) !== "paused" && state(g) !== "resting");
  // The family's picks and the story first; gentle films before harsh ones.
  // Songs from their teens and twenties first (the reminiscence bump, about 18); everyday places before galleries.
  const by = p.birthYear ?? (p.decade !== null ? p.decade + 5 : null);
  const bump = (g: GalleryItem) => (g.type === "song" && g.year && by ? Math.max(0, 10 - Math.abs(g.year - by - 18) / 2) : 0);
  const everyday = (g: GalleryItem) => (g.type === "place" && EVERYDAY.test(g.title) ? 10 : 0);
  const score = (g: GalleryItem) =>
    (g.answer === "yes" || g.origin === "family" ? 50 : 0) + (g.story ? 40 : 0) + (isHarsh(g.genres) ? -30 : isGentle(g.genres) ? 5 : 0) + bump(g) + everyday(g) + (g.stat?.sangSessions ?? 0) * 3 + (g.stat?.engagedSessions ?? 0) * 2 + (g.stat?.calmSessions ?? 0);
  // Telly that ran through more of their ages 10–30 first (IM-3); within the gentle ones, the familiar films (IM-4).
  const run = (g: GalleryItem) => (g.type === "tv" && by ? (youthRun(g.year, g.runTo, by)?.years ?? 0) : 0);
  const shelf = (t: GalleryType) => live.filter((g) => g.type === t && g.origin !== "new_try").sort((a, b) => score(b) + run(b) - (score(a) + run(a)) || (b.popularity ?? 0) - (a.popularity ?? 0));
  return {
    works: live.filter((g) => state(g) === "proven").sort((a, b) => score(b) - score(a)),
    // Places: at most five (PR-5).
    shelves: { song: shelf("song"), film: shelf("film"), tv: shelf("tv"), book: shelf("book"), place: shelf("place").slice(0, 5) },
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
export function calmPick(g: Gallery, except?: string | GalleryItem): GalleryItem | null {
  const all = [...g.works, ...Object.values(g.shelves).flat(), ...g.newTries];
  const calm = all.filter((x) => x.type === "song" && !isSame(x, except) && (x.stat?.calmSessions ?? 0) > 0);
  return calm.sort((a, b) => (b.stat?.calmSessions ?? 0) - (a.stat?.calmSessions ?? 0))[0] ?? null;
}

/** The item just stopped, by key or by title: the family's "I Only Want to Be With You" and Qloo's are one song. */
const isSame = (x: GalleryItem, except?: string | GalleryItem) => (typeof except === "string" ? x.key === except : except ? x.key === except.key || nameKey(x.title) === nameKey(except.title) : false);

/**
 * What Stop offers instead (FC-5): something logged calm, else a song the family chose. Never the item just stopped
 * (nor the same song under another key), anything paused, or anything on steer clear. Nothing qualifies: null, and
 * the basics are offered alone.
 */
export function settlePick(g: Gallery, p: Pick<Person, "steers">, stopped: GalleryItem): { item: GalleryItem; logged: boolean } | null {
  const ok = (x: GalleryItem) => !isSame(x, stopped) && x.stat?.state !== "paused" && !steersClear(p, x.title, x.by);
  const calm = calmPick(g, stopped);
  if (calm && ok(calm)) return { item: calm, logged: true };
  const family = g.shelves.song.find((x) => x.origin === "family" && ok(x));
  return family ? { item: family, logged: false } : null;
}
