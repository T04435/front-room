import { z } from "zod";
import { nameKey } from "./qloo-parse";

/**
 * A person: their story as the family or staff told it, following the Alzheimer's Society's "This is me" themes. Only
 * confirmed facts are kept (the chat discards the raw transcript). No surname, address, diagnosis or medication.
 */

export const CONSENT_BY = ["self", "family", "staff"] as const;
export const CONSENT_BASIS = ["agreed", "best_interests"] as const;
export const MOMENT_KINDS = ["wedding", "dance", "move", "service", "other"] as const;
export const LOVE_TYPES = ["song", "artist", "film", "tv", "book", "place", "team", "dance", "other"] as const;
export const LOVE_SOURCES = ["family", "ring_a_bell", "staff_heard", "self"] as const;
export const STEER_KINDS = ["topic", "person", "item", "sound"] as const;
export const STEER_LEVELS = ["never", "sad_ok"] as const;
export const HEARD_KINDS = ["name", "place", "job", "song", "dance", "other"] as const;

export type Consent = { by: (typeof CONSENT_BY)[number]; basis: (typeof CONSENT_BASIS)[number]; role?: string; at: string };
/** `yearsUnknown`: the family said they're not sure of the years, so the chat stops asking. */
export type Place = { id: string; name: string; label?: string; fromYear: number | null; toYear: number | null; role?: string; yearsUnknown?: boolean };
export type Moment = { id: string; kind: (typeof MOMENT_KINDS)[number]; year: number | null; label: string; venue?: string };
export type Love = {
  id: string;
  type: (typeof LOVE_TYPES)[number];
  title: string;
  /** A song's artist. */
  by?: string;
  /** A picture for the tile, when one is known (Qloo's image URL). */
  image?: string;
  year?: number | null;
  qlooId?: string;
  source: (typeof LOVE_SOURCES)[number];
  quote?: string;
  placeId?: string;
};
export type Steer = { id: string; kind: (typeof STEER_KINDS)[number]; label: string; level: (typeof STEER_LEVELS)[number]; source: "family" | "logged"; at: string };
export type Practical = {
  calms?: string;
  bestTime?: string;
  hearing?: string;
  headphonesOk?: boolean | null;
  greeting?: string;
  work?: string;
  faith?: { stance: "yes" | "no" | "keep_out"; label?: string };
};
export type StaffHeard = { id: string; kind: (typeof HEARD_KINDS)[number]; text: string; at: string; kitId?: string; confirmed?: boolean };

/**
 * One thing in the person's gallery from Qloo: for a place and era, like something they love, or a new try like
 * something that works. The family's quick answer once given ("Loved it" or "Not for them").
 */
export type Suggestion = {
  id: string;
  placeId: string;
  type: "song" | "artist" | "film" | "tv" | "book" | "place";
  /** New tries: what it's like ("Waterloo"), found because that works for them. */
  like?: string;
  title: string;
  by?: string;
  year: number | null;
  /** Source line parts: "60s · Manchester · Qloo". */
  parts: string[];
  source: string;
  qlooId?: string;
  /** A picture for the tile: Qloo's image (an artist photo for songs, a poster, a place). Only the URL is kept. */
  image?: string;
  /** Films and TV: genre names from Qloo, to keep the gallery gentle. */
  genres?: string[];
  answer?: "yes" | "unsure" | "upset";
};

export type Person = {
  id: string;
  preferredName: string;
  birthYear: number | null;
  /** When only the decade is known (1950 for "the fifties"). */
  decade: number | null;
  languages: string[];
  consent: Consent | null;
  places: Place[];
  moments: Moment[];
  loves: Love[];
  steers: Steer[];
  /** The family answered the steer-clear question, even if with "nothing". */
  steerAsked: boolean;
  practical: Practical;
  staffHeard: StaffHeard[];
  /** Item keys whose upset was answered "sad but OK" or "a one-off": no longer paused. */
  resolvedUpsets: string[];
  /** Ring a bell? cards per place-and-era key, and the inputs each was researched from (to rerun only what changed). */
  suggestions: Record<string, Suggestion[]>;
  researched: Record<string, string>;
  example?: boolean;
  createdAt: string;
  updatedAt: string;
};

export function emptyPerson(id: string, preferredName: string, consent: Consent | null, now = new Date().toISOString()): Person {
  return {
    id,
    preferredName,
    birthYear: null,
    decade: null,
    languages: [],
    consent,
    places: [],
    moments: [],
    loves: [],
    steers: [],
    steerAsked: false,
    practical: {},
    staffHeard: [],
    resolvedUpsets: [],
    suggestions: {},
    researched: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** The birth year to work from: the year, else the middle of the decade. */
export const birthYearOf = (p: Pick<Person, "birthYear" | "decade">): number | null => p.birthYear ?? (p.decade !== null ? p.decade + 5 : null);

/** The minimum to build anything: preferred name, a birth year or decade, and one place. What's missing, in order. */
export type Missing = "preferredName" | "birthYear" | "place";
export function missingMinimum(p: Person): Missing[] {
  const out: Missing[] = [];
  if (!p.preferredName.trim()) out.push("preferredName");
  if (birthYearOf(p) === null) out.push("birthYear");
  if (!p.places.length) out.push("place");
  return out;
}

/** How complete the story is, as a percentage: the "This is me" themes that have something in them. */
export function completeness(p: Person): number {
  const checks = [
    Boolean(p.preferredName),
    birthYearOf(p) !== null,
    p.places.length > 0,
    p.places.some((x) => x.fromYear !== null),
    p.places.length > 1,
    p.moments.length > 0,
    p.loves.length >= 3,
    p.steerAsked || p.steers.length > 0,
    Boolean(p.practical.calms),
    Boolean(p.practical.work),
    p.practical.hearing !== undefined || p.practical.headphonesOk !== undefined,
    p.consent !== null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/** Ages 10–30: the years memory for music and culture is strongest. */
export const ERA_FROM_AGE = 10;
export const ERA_TO_AGE = 30;

/**
 * The era to research for a place: the years it overlaps with ages 10–30, or the place's own years when there's no
 * overlap (a later chapter). A place with no years counts as where they grew up.
 */
export function eraForPlace(place: Pick<Place, "fromYear" | "toYear">, birthYear: number, thisYear = new Date().getFullYear()): { from: number; to: number } {
  const bumpFrom = birthYear + ERA_FROM_AGE;
  const bumpTo = Math.min(birthYear + ERA_TO_AGE, thisYear);
  if (place.fromYear === null) return { from: bumpFrom, to: bumpTo };
  const to = place.toYear ?? thisYear;
  const from = Math.max(place.fromYear, bumpFrom);
  const end = Math.min(to, bumpTo);
  if (from <= end) return { from, to: end };
  // No overlap: the place's own years, at most 15 of them so the research stays focused on its start.
  return { from: place.fromYear, to: Math.min(to, place.fromYear + 15) };
}

/** The key a place's research is stored under: it changes when the place, its years or the birth year change. */
export const researchKey = (place: Place, birthYear: number) => {
  const e = eraForPlace(place, birthYear);
  return `${place.id}:${e.from}-${e.to}`;
};

/**
 * What a place's research depends on (the place, its era, and the loves that seed it), to rerun only what changed.
 * Steer-clears aren't in it: they filter the cards wherever they're shown, so a new one never needs a fresh look-up.
 */
export function researchInputs(p: Person, place: Place): string {
  const by = birthYearOf(p) ?? 0;
  return JSON.stringify([place.name, eraForPlace(place, by), p.loves.filter((l) => l.source !== "ring_a_bell").map((l) => nameKey(l.title)).sort()]);
}

/** Whether a title matches a steer-clear label (either contains the other, by words). */
export function steersClear(p: Pick<Person, "steers">, ...texts: (string | undefined)[]): boolean {
  const labels = p.steers.map((s) => nameKey(s.label)).filter((l) => l.length >= 3);
  return texts.some((t) => {
    if (!t) return false;
    const k = ` ${nameKey(t)} `;
    return labels.some((l) => k.includes(` ${l} `));
  });
}

/**
 * Places in order, each with no end year closed where the next one starts (A7): "Glasgow, 1949" then "Blackpool,
 * 1971" makes Glasgow 1949–1971, so its era never runs past the move.
 */
export function withEndYears(places: Place[]): Place[] {
  const dated = places.filter((x) => x.fromYear !== null).sort((a, b) => a.fromYear! - b.fromYear!);
  return places.map((x) => {
    if (x.fromYear === null || x.toYear !== null) return x;
    const next = dated.find((y) => y.fromYear! > x.fromYear!);
    return next ? { ...x, toYear: next.fromYear } : x;
  });
}

/** Partners: a steer-clear naming one rules out the wedding too. */
const PARTNER = /\b(husband|wife|partner|spouse|fianc[eé]e?|ex|first husband|first wife|marriage|wedding)\b/i;

/**
 * Whether a moment (a talking point) touches anything on steer clear (A3): its words match a steer-clear label, or a
 * steer-clear names a husband, wife or partner and the moment is the wedding. The same rule as the gallery's.
 */
export function momentSteered(p: Pick<Person, "steers">, m: Pick<Moment, "kind" | "label" | "venue">): boolean {
  if (steersClear(p, m.label, m.venue)) return true;
  // A name in a steer-clear, said in the moment: "Husband Frank" against "Married Frank in 1971".
  const said = ` ${nameKey(`${m.label} ${m.venue ?? ""}`)} `;
  const names = (label: string) => label.split(/\s+/).filter((w) => /^[A-Z][a-z]{2,}/.test(w) && !PARTNER.test(w)).map(nameKey);
  if (p.steers.some((s) => names(s.label).some((w) => said.includes(` ${w} `)))) return true;
  const partner = p.steers.some((s) => PARTNER.test(s.label));
  return partner && (m.kind === "wedding" || /\b(wedding|married|marriage|honeymoon|engaged)\b/i.test(m.label));
}

/** The talking points to offer: moments that don't touch steer clear. */
export const talkingPoints = (p: Pick<Person, "steers" | "moments">) => p.moments.filter((m) => !momentSteered(p, m));

// ---- What the story chat's extractor returns (candidates, never saved until confirmed) -----------------------------

export const factSchema = z.object({
  kind: z.enum(["preferredName", "birthYear", "decade", "place", "moment", "love", "painful", "calms", "upsets", "work", "faith", "hearing", "language", "greeting", "bestTime"]),
  /** The main value: a name, a place, a title, a label. */
  value: z.string(),
  /** For places: the years there, if said. For moments and loves: the year, if said. For birthYear/decade: the year. */
  fromYear: z.number().int().nullable(),
  toYear: z.number().int().nullable(),
  /** Moments: wedding, dance, move, service, other. Loves: song, artist, film, tv, book, place, team, dance, other. Places: grew up, lived, worked. */
  detail: z.string().nullable(),
  /** A song's artist, or a moment's venue. */
  extra: z.string().nullable(),
  /** The teller's own words this came from, short. */
  quote: z.string(),
});
export const extractionSchema = z.object({
  facts: z.array(factSchema),
  /** One or two questions that dig into what was just said, toward what's still missing ("What did Margot do in Blackpool?"). */
  followUps: z.array(z.string()),
});
export type Fact = z.infer<typeof factSchema>;

/** A person as anyone may read it: the example is marked so the page can make it read-only. */
export type PersonSummary = { id: string; preferredName: string; completeness: number; lastSession: string | null; sessions: number; ready: boolean; example: boolean };
