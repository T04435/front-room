import { z } from "zod";
import { MAX_BIRTH_YEAR, MIN_BIRTH_YEAR, type Era } from "./era";
import type { Via } from "./qloo-transport";

// ---- The brief: what a carer or family member enters --------------------------------------------------------------

export const briefSchema = z.object({
  /** A first name or nickname for the kit's title; optional, never sent to Qloo. */
  name: z.string().trim().max(40).optional(),
  birthYear: z.number().int().min(MIN_BIRTH_YEAR).max(MAX_BIRTH_YEAR),
  /** Where they grew up: a town or city, as typed. */
  place: z.string().trim().min(2).max(80),
  /** Things the family already knows they loved: artists, films, a dance hall. */
  likes: z.array(z.string().trim().min(2).max(80)).max(5).optional(),
  /** The years to search, when a carer widened or shifted the default ages 15–25 (5 to 20 years). */
  years: z
    .tuple([z.number().int(), z.number().int()])
    .refine(([a, b]) => b - a >= 5 && b - a <= 20, "Search 5 to 20 years")
    .optional(),
  /** Answers to the run's inline question, sent back with the same brief. */
  answers: z
    .object({
      /** A bigger town nearby, when Qloo doesn't know the place. */
      nearbyPlace: z.string().trim().min(2).max(80).optional(),
      /** A kind of music they loved, when the era comes back thin. */
      musicWords: z.string().trim().min(2).max(120).optional(),
      /** "Skip this" on the inline question: carry on without the place, or with the music found so far. */
      skipPlace: z.boolean().optional(),
      skipMusic: z.boolean().optional(),
    })
    .optional(),
  /** Items the family marked "not for them" on an earlier run. */
  avoid: z.array(z.string().max(120)).max(30).optional(),
});
export type Brief = z.infer<typeof briefSchema>;
export type AskField = "nearbyPlace" | "musicWords";

// ---- Kit items: everything the kit holds, one shape -----------------------------------------------------------------

/**
 * The kinds of thing a kit can hold. A kit is reminiscence across what Qloo knows about someone's youth: songs are one
 * kind among films, TV, places and the rest, never a separate table. `family`: something the family told us that Qloo
 * doesn't know, cited as itself. (Books are in the model; Qloo's publication years are editions, so the run skips them
 * for now.)
 */
export const ITEM_TYPES = ["song", "artist", "film", "tv", "place", "book", "family"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const REF_PREFIX: Record<ItemType, string> = { song: "S", artist: "A", film: "F", tv: "T", place: "P", book: "B", family: "K" };
export const TYPE_LABELS: Record<ItemType, string> = { song: "Song", artist: "Artist", film: "Film", tv: "TV", place: "Place", book: "Book", family: "From the family" };

export const PHASES = ["calm", "familiar", "singalong"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = { calm: "Settle in", familiar: "Familiar", singalong: "Sing along" };

/**
 * One item. `ref` (S1, A2, F3, P1, K1) is how prompts and songs cite it. `source` says where it came from in words
 * ("Qloo: 60s music, popular around Manchester", "AI pick: a recording by A3"); `via` which way a Qloo call went
 * (NotOnQ's drop-in API, or Qloo directly), null for AI picks and the family. `why`: the curator's line for staff on
 * an item the kit features (every song; the films, TV and places it picks); null for research only.
 */
export type KitItem = {
  ref: string;
  type: ItemType;
  title: string;
  year: number | null;
  /** The source line's parts, era · place · source: ["60s", "Manchester", "Qloo"], ["film", "1965–75", "Qloo"]. */
  parts: string[];
  /** "family": the family named it (a like they gave, or Qloo's match for it). */
  addedBy?: "family";
  source: string;
  why: string | null;
  via: Via | null;
  /** Qloo's entity id, kept to link back; never shown. */
  entityId: string | null;
  /** Qloo's one-line description (places). */
  description?: string | null;
  /** Songs: the artist item it's by, its place in the session, links out (no media hosted), its length. */
  by?: { ref: string; title: string };
  phase?: Phase;
  links?: { spotify: string; youtube: string };
  minutes?: number;
  /** Songs: "musicbrainz" when MusicBrainz confirms the artist has a recording with this title; "unchecked" when it couldn't be asked. */
  check?: "musicbrainz" | "unchecked";
  /** The same thing across a person's kits (src/lib/learning.ts itemKey), for what's proven, paused or resting. */
  key?: string;
  /** Why it's in a person's kit: proven before, the family said yes, matches their era, or a new try like something proven. */
  reason?: "proven" | "family_yes" | "era_match" | "new_try";
  /** New tries: what it's like ("Waterloo, 70s, Manchester"). */
  like?: string;
};

// ---- What the curator writes, checked against the research --------------------------------------------------------

export const curatedSchema = z.object({
  songs: z
    .array(
      z.object({
        artistRef: z.string().describe("The artist's ref from the research list, e.g. A3"),
        title: z.string().describe("A well-known recording by that artist from the era years, its exact title"),
        year: z.number().int().nullable().describe("The recording's release year if known"),
        phase: z.enum(PHASES),
        why: z.string().describe("One short line for staff: why this one, at this point"),
      }),
    )
    .describe("4 or 5 songs, in playing order: calm first, then familiar, then singalong"),
  picks: z
    .array(z.object({ ref: z.string().describe("A film, TV or place ref from the research list"), why: z.string().describe("One short line for staff: how to bring it up") }))
    .describe("One film, one TV show and one or two places worth talking about"),
  prompts: z
    .array(
      z.object({
        text: z.string().describe("A gentle, open question staff can say out loud"),
        reply: z.string().describe("What they might answer, so new staff know what to listen for: one short line"),
        refs: z.array(z.string()).describe("Refs of the items it mentions (1–3)"),
      }),
    )
    .describe("4 or 5 prompts"),
  summary: z.string().describe("One sentence for staff on the kit's shape"),
});
export type Curated = z.infer<typeof curatedSchema>;
export type Prompt = Curated["prompts"][number];

export type Kit = {
  id: string;
  /** The brief it was built from; `avoid` carries the family's "not for them" marks into the next rebuild. */
  brief: Pick<Brief, "name" | "birthYear" | "place" | "likes" | "avoid" | "years">;
  place: string;
  era: Era;
  /** Everything in the kit: the research, the songs (in playing order) and the curator's picks. */
  items: KitItem[];
  prompts: Prompt[];
  summary: string;
  /** How many of the research calls went through NotOnQ, and how many fell back to Qloo directly. */
  sources: { notonq: number; qloo: number; fellBack: number };
  /** A person's kit: whose, and the session goal. Absent on the one-off kits built from a brief. */
  personId?: string;
  goal?: "settle" | "chat" | "sing";
  model: string;
  createdAt: string;
};

// Tearful is its own response: personal music can bring sadness without distress (research, 26 Oct).
export const RESPONSES = ["calm", "engaged", "sang", "tearful", "upset"] as const;
/** "none": shown in a session with no reaction (session mode logs it on moving on); never a button. */
export type Response = (typeof RESPONSES)[number] | "none";
export const RESPONSE_LABELS: Record<Response, string> = { calm: "Calm", engaged: "Engaged", sang: "Sang along", tearful: "Tearful", upset: "Upset", none: "No reaction" };
/** One tap; `itemRef` is what was on (a song playing, a film being talked about), if anything. */
export type LogEntry = { id: number; response: Response; itemRef: string | null; at: string };

/**
 * The 20-minute session: about 3 minutes a song (singles of the era ran short), 5 minutes on the screen (a film and a
 * TV show), 3 on a place from home.
 */
export const SONG_MINUTES = 3;
/** Five songs at most: about 12–15 minutes of the 20. */
export const MAX_SONGS = 5;
export const SCREEN_MINUTES = 5;
export const PLACE_MINUTES = 3;

export function searchLinks(artist: string, title: string) {
  const q = encodeURIComponent(`${artist} ${title}`);
  return { spotify: `https://open.spotify.com/search/${q}`, youtube: `https://www.youtube.com/results?search_query=${q}` };
}

export type Problem = { where: string; message: string };

/**
 * The curator's reply, checked against the research. A song must cite a known artist (one song per artist), a pick a
 * known film, TV show or place, a prompt known items; anything else is dropped and reported, so nothing on the page
 * points at a source that doesn't exist. Songs become items (S1…) in phase order, keeping the curator's order within a
 * phase; picks set `why` on their item.
 */
export function checkCurated(curated: Curated, research: KitItem[]): { items: KitItem[]; prompts: Prompt[]; problems: Problem[] } {
  const byRef = new Map(research.map((i) => [i.ref, i]));
  const problems: Problem[] = [];
  const used = new Set<string>();
  const songs: KitItem[] = [];
  curated.songs.forEach((s, n) => {
    const artist = byRef.get(s.artistRef);
    const title = s.title.trim();
    if (!artist || artist.type !== "artist") return problems.push({ where: `song ${n + 1}`, message: `cites ${s.artistRef}, which isn't an artist in the research` });
    if (used.has(s.artistRef)) return problems.push({ where: `song ${n + 1}`, message: `${artist.title} already has a song` });
    if (!title) return problems.push({ where: `song ${n + 1}`, message: "has no title" });
    if (songs.length >= MAX_SONGS) return problems.push({ where: `song ${n + 1}`, message: `more than ${MAX_SONGS} songs` });
    used.add(s.artistRef);
    songs.push({
      ref: "",
      type: "song",
      title,
      year: s.year,
      parts: artist.parts,
      ...(artist.addedBy ? { addedBy: artist.addedBy } : {}),
      source: `AI pick: a recording by ${artist.title}`,
      why: s.why.trim() || null,
      via: null,
      entityId: null,
      by: { ref: artist.ref, title: artist.title },
      phase: s.phase,
      links: searchLinks(artist.title, title),
      minutes: SONG_MINUTES,
    });
  });
  const ordered = PHASES.flatMap((p) => songs.filter((s) => s.phase === p)).map((s, n) => ({ ...s, ref: `${REF_PREFIX.song}${n + 1}` }));

  const why = new Map<string, string>();
  curated.picks.forEach((p, n) => {
    const item = byRef.get(p.ref);
    if (!item || !["film", "tv", "place", "book"].includes(item.type)) return problems.push({ where: `pick ${n + 1}`, message: `cites ${p.ref}, not a film, TV show or place in the research` });
    if (p.why.trim()) why.set(p.ref, p.why.trim());
  });
  const items = [...ordered, ...research.map((i) => (why.has(i.ref) ? { ...i, why: why.get(i.ref)! } : i))];

  const known = new Set(items.map((i) => i.ref));
  const prompts = curated.prompts.flatMap((p, n) => {
    const refs = [...new Set(p.refs)];
    const unknown = refs.filter((r) => !known.has(r));
    if (unknown.length || !p.text.trim()) {
      problems.push({ where: `prompt ${n + 1}`, message: unknown.length ? `cites ${unknown.join(", ")}, not in the kit` : "is empty" });
      return [];
    }
    return [{ text: p.text.trim(), reply: p.reply.trim(), refs }];
  });
  return { items, prompts, problems };
}

/** The playlist section: the kit's songs, in playing order. */
export const songsOf = (items: KitItem[]) => items.filter((i) => i.type === "song");
/** Items the curator featured (they have a `why`), of these types. */
export const featured = (items: KitItem[], types: ItemType[]) => items.filter((i) => i.why && types.includes(i.type));

export function songMinutes(items: KitItem[]): number {
  return songsOf(items).reduce((sum, s) => sum + (s.minutes ?? 0), 0);
}

export function sessionMinutes(items: KitItem[]): number {
  return songMinutes(items) + (featured(items, ["film", "tv"]).length ? SCREEN_MINUTES : 0) + (featured(items, ["place"]).length ? PLACE_MINUTES : 0);
}

/** A source line's parts for an item saved before items carried them. */
export function partsOf(item: KitItem): string[] {
  return item.parts?.length ? item.parts : [item.type === "family" ? "family" : item.type, item.via ? "Qloo" : "the family"].filter(Boolean);
}

export function kitTitle(kit: Pick<Kit, "brief" | "place" | "era">): string {
  const who = kit.brief.name ? `${kit.brief.name}'s` : "A";
  return `${who} session kit · ${kit.place}, ${kit.era.from}–${kit.era.to}`;
}
