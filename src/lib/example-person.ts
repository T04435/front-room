import { EXAMPLE_KIT } from "./example-kit";
import type { Kit } from "./kit";
import { itemKey, type Goal, type Logged, type Play } from "./learning";
import type { Person } from "./person";

/**
 * The fictional Margaret, preloaded for judges: read-only, with five past sessions so the learning shows. Her kits
 * reuse the example kit's real research (25 Oct). The logs are written so that, by the rules in learning.ts:
 * - Waterloo and You Don't Have to Say You Love Me are proven;
 * - Yesterday is paused after an upset on 24 Oct;
 * - Lola is resting (no reaction three times);
 * - Maggie May has been tried once.
 */
export const EXAMPLE_PERSON_ID = "margaret-x";

export const EXAMPLE_PERSON: Person = {
  id: EXAMPLE_PERSON_ID,
  preferredName: "Margaret",
  birthYear: 1950,
  decade: null,
  languages: ["English"],
  consent: { by: "family", basis: "agreed", at: "2026-10-19T10:00:00.000Z" },
  places: [
    { id: "pl-mcr", name: "Manchester", label: "Manchester, United Kingdom", fromYear: 1950, toYear: 1972, role: "grew up" },
    { id: "pl-bpl", name: "Blackpool", label: "Blackpool, United Kingdom", fromYear: 1972, toYear: 1995, role: "lived after marrying" },
  ],
  moments: [
    { id: "mo-1", kind: "dance", year: 1968, label: "Danced at the Ritz every Saturday", venue: "the Ritz, Manchester" },
    { id: "mo-2", kind: "wedding", year: 1972, label: "Married in 1972" },
  ],
  loves: [
    { id: "lv-1", type: "artist", title: "Dusty Springfield", source: "family", quote: "she loved Dusty" },
    { id: "lv-2", type: "film", title: "The Sound of Music", year: 1965, source: "ring_a_bell", placeId: "pl-mcr" },
    { id: "lv-3", type: "place", title: "O2 Ritz Manchester", source: "ring_a_bell", placeId: "pl-mcr" },
    { id: "lv-4", type: "song", title: "Waterloo", by: "ABBA", year: 1974, source: "ring_a_bell", placeId: "pl-mcr" },
    { id: "lv-5", type: "book", title: "The Mallen Streak", by: "Catherine Cookson", year: 1973, source: "family", quote: "read every Catherine Cookson" },
  ],
  steers: [
    { id: "st-1", kind: "person", label: "Brother Tom", level: "never", source: "family", at: "2026-10-19T10:05:00.000Z" },
    { id: "st-2", kind: "sound", label: "Loud bangs", level: "never", source: "family", at: "2026-10-19T10:05:00.000Z" },
  ],
  steerAsked: true,
  practical: {
    calms: "Dusty, softly, in a quiet room",
    bestTime: "Mornings",
    hearing: "Hears better on the left",
    headphonesOk: false,
    greeting: "Likes “Maggie” from people they know",
    work: "Worked in a shop on Market Street",
  },
  staffHeard: [{ id: "sh-1", kind: "job", text: "Worked at the cotton mill before the shop", at: "2026-10-23T18:30:00.000Z" }],
  resolvedUpsets: [],
  suggestions: {},
  researched: {},
  example: true,
  createdAt: "2026-10-19T10:00:00.000Z",
  updatedAt: "2026-10-24T18:40:00.000Z",
};

type Session = { date: string; goal: Goal; logs: [ref: string, response: Logged["response"], minute: number][] };

const SESSIONS: Session[] = [
  { date: "2026-10-20T10:30:00.000Z", goal: "chat", logs: [["S1", "engaged", 2], ["S2", "calm", 5], ["S3", "none", 8], ["S4", "none", 11], ["S5", "sang", 14], ["F1", "engaged", 17]] },
  { date: "2026-10-21T18:10:00.000Z", goal: "settle", logs: [["S1", "calm", 2], ["S1", "engaged", 3], ["S2", "calm", 6], ["S4", "none", 9]] },
  { date: "2026-10-22T10:15:00.000Z", goal: "chat", logs: [["S5", "sang", 3], ["S3", "engaged", 6], ["S4", "none", 9], ["P3", "engaged", 13]] },
  { date: "2026-10-23T15:00:00.000Z", goal: "sing", logs: [["S1", "sang", 2], ["S5", "sang", 5]] },
  { date: "2026-10-24T18:20:00.000Z", goal: "chat", logs: [["S1", "engaged", 2], ["S2", "upset", 5], ["T4", "engaged", 9]] },
];

const keyed = EXAMPLE_KIT.items.map((i) => ({ ...i, key: itemKey(i), entityId: null }));

/** Margaret's five past kits. */
export const EXAMPLE_KITS: Kit[] = SESSIONS.map((s, n) => ({
  ...EXAMPLE_KIT,
  id: `margaret-k${n + 1}`,
  items: keyed,
  personId: EXAMPLE_PERSON_ID,
  goal: s.goal,
  createdAt: s.date,
}));

/** What was logged in them. */
export const EXAMPLE_LOGS: Logged[] = SESSIONS.flatMap((s, n) =>
  s.logs.map(([ref, response, minute], i) => ({
    id: -(n * 100 + i + 1),
    kitId: `margaret-k${n + 1}`,
    itemRef: ref,
    response,
    at: new Date(new Date(s.date).getTime() + minute * 60_000).toISOString(),
  })),
);

export const isExampleKitId = (id: string) => /^margaret-k\d$/.test(id);

/** Her past sessions as gallery plays (what the gallery learns from). */
export const EXAMPLE_PLAYS: Play[] = EXAMPLE_LOGS.flatMap((l) => {
  const item = keyed.find((i) => i.ref === l.itemRef);
  return item ? [{ id: l.id, itemKey: item.key, type: item.type, title: item.title, by: item.by?.title, response: l.response, at: l.at }] : [];
});

/** Genres for her films and TV, as Qloo tags them (the 25 Oct run predates keeping them). */
const EXAMPLE_GENRES: Record<string, string[]> = {
  "The Sound of Music": ["musical", "family"],
  "The Jungle Book": ["animation", "family", "musical"],
  Papillon: ["drama", "prison", "war"],
  "The Godfather": ["crime", "drama"],
  "Who's Afraid of Virginia Woolf?": ["drama"],
  "American Graffiti": ["comedy", "music"],
  "Monty Python's Flying Circus": ["comedy"],
  Columbo: ["crime", "mystery"],
  "Star Trek": ["science fiction"],
  "Fawlty Towers": ["comedy"],
};

/** Her gallery: the example kit's real research (25 Oct), plus three new tries like what works (a live run, 26 Oct). */
EXAMPLE_PERSON.suggestions = {
  "pl-mcr:example": keyed
    .filter((i) => ["song", "film", "tv", "place"].includes(i.type))
    .map((i) => ({
      id: `ex-${i.ref}`,
      placeId: "pl-mcr",
      type: i.type as "song" | "film" | "tv" | "place",
      title: i.title,
      ...(i.by ? { by: i.by.title } : {}),
      year: i.year,
      parts: i.parts,
      source: i.source,
      ...(EXAMPLE_GENRES[i.title] ? { genres: EXAMPLE_GENRES[i.title] } : {}),
    })),
  "new-tries": [
    { id: "ex-nt1", placeId: "pl-mcr", type: "song", title: "(Sittin' On) The Dock of the Bay", by: "Otis Redding", year: 1968, like: "You Don't Have to Say You Love Me", parts: ["60s", "like Dusty Springfield", "Manchester", "Qloo"], source: "New try: Qloo, liked by people who like Dusty Springfield, 60s, Manchester." },
    { id: "ex-nt2", placeId: "pl-mcr", type: "song", title: "Walk On By", by: "Dionne Warwick", year: 1964, like: "You Don't Have to Say You Love Me", parts: ["60s", "like Dusty Springfield", "Manchester", "Qloo"], source: "New try: Qloo, liked by people who like Dusty Springfield, 60s, Manchester." },
    { id: "ex-nt3", placeId: "pl-mcr", type: "song", title: "Mamma Mia", by: "ABBA", year: 1975, like: "Waterloo", parts: ["70s", "like Waterloo", "Manchester", "Qloo"], source: "New try: Qloo, liked by people who like ABBA, 70s, Manchester." },
  ],
};
