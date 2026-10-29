import { describe, expect, it } from "vitest";
import { hookFor } from "@/lib/card-words";
import { EXAMPLE_PERSON, EXAMPLE_PLAYS } from "@/lib/example-person";
import { galleryOf } from "@/lib/gallery";
import { itemKey, playStats, type Play } from "@/lib/learning";
import { emptyPerson, type Person, type Suggestion } from "@/lib/person";
import { standInsFor } from "@/server/bell";
import { seedsOf } from "@/server/new-tries";

// Batch 1, chunk B: improvements that use Qloo's data (IM-1 to IM-5). Offline: example and fixture-shaped data only.
const NOW = new Date("2026-10-25T12:00:00Z");
const card = (id: string, type: Suggestion["type"], title: string, more: Partial<Suggestion> = {}): Suggestion => ({ id, placeId: "pl", type, title, year: null, parts: [], source: "Qloo", ...more });
const joan = (suggestions: Person["suggestions"], more: Partial<Person> = {}): Person => ({
  ...emptyPerson("abcdefghij", "Joan", null),
  birthYear: 1946,
  places: [{ id: "pl", name: "Liverpool", fromYear: 1946, toYear: 1968 }],
  suggestions,
  ...more,
});
const play = (id: number, title: string, by: string, response: Play["response"], at: string): Play => ({ id, itemKey: itemKey({ type: "song", title, by }), type: "song", title, by, response, at });

describe("IM-1: sound-alikes follow an upset", () => {
  const p = joan({
    pl: [card("s1", "song", "Waterloo", { by: "ABBA" })],
    "new-tries": [card("n1", "song", "Mamma Mia", { by: "ABBA", like: "Waterloo" }), card("n2", "song", "Walk On By", { by: "Dionne Warwick", like: "Anyone Who Had a Heart" })],
  });
  const upset = [play(1, "Waterloo", "ABBA", "upset", "2026-10-24T15:00:00Z")];

  it("hides new tries found like a paused item, and names them in Avoid's words", () => {
    const g = galleryOf(p, playStats(upset, [], NOW));
    expect(g.newTries.map((x) => x.title)).toEqual(["Walk On By"]);
    expect(g.paused.map((x) => x.title)).toEqual(["Waterloo"]);
  });

  it("brings them back once the family answers", () => {
    const key = itemKey({ type: "song", title: "Waterloo", by: "ABBA" });
    const g = galleryOf({ ...p, resolvedUpsets: [key] }, playStats(upset, [key], NOW));
    expect(g.newTries.map((x) => x.title)).toContain("Mamma Mia");
  });

  it("never seeds the next round from a paused item or its artist", () => {
    const loves: Person["loves"] = [{ id: "l1", type: "artist", title: "ABBA", source: "family" }, { id: "l2", type: "artist", title: "Cilla Black", source: "family" }];
    expect(seedsOf({ ...p, loves }, playStats(upset, [], NOW)).map((s) => s.like)).toEqual(["Cilla Black"]);
  });
});

describe("IM-2: Because X worked", () => {
  it("says which proven item seeded a new try (Margaret, for whom Waterloo works)", () => {
    const g = galleryOf(EXAMPLE_PERSON, playStats(EXAMPLE_PLAYS, [], NOW, "Europe/London"));
    const mamma = g.newTries.find((x) => x.title === "Mamma Mia");
    expect(mamma?.why).toBe("Because ‘Waterloo’ worked for Margaret, Qloo found more liked by the same people, 70s, Manchester.");
    expect(mamma?.whyShort).toBe("Because ‘Waterloo’ worked");
  });

  it("before anything's proven, keeps 'like the family's pick'", () => {
    const g = galleryOf(joan({ "new-tries": [card("n1", "song", "Walk On By", { by: "Dionne Warwick", like: "Cilla Black", parts: ["60s", "like Cilla Black", "Liverpool", "Qloo"] })] }), new Map());
    expect(g.newTries[0].why).toBe("Qloo: people who like Cilla Black also like this. The family picked Cilla Black.");
  });
});

describe("IM-3: long-running telly first", () => {
  const g = galleryOf(joan({ pl: [card("t1", "tv", "Fawlty Towers", { year: 1975, runTo: 1979 }), card("t2", "tv", "Coronation Street", { year: 1960, runTo: 2026 }), card("t3", "tv", "Hancock's Half Hour", { year: 1956, runTo: 1961 })] }), new Map());

  it("ranks by how much of their ages 10–30 the run covers", () => {
    expect(g.shelves.tv.map((x) => x.title)).toEqual(["Coronation Street", "Hancock's Half Hour", "Fawlty Towers"]);
  });

  it("says 'all through her twenties' only when the run covers them", () => {
    expect(g.shelves.tv[0].hook).toBe("On the telly all through Joan’s twenties.");
    expect(hookFor(joan({}), { type: "tv", year: 1975, runTo: 1979, origin: "qloo" })).toBe("Out in 1975, when Joan was 29.");
  });
});

describe("IM-4: familiar films first", () => {
  it("sorts the gentle films by Qloo's popularity, harsh ones still last", () => {
    const g = galleryOf(
      joan({ pl: [card("f1", "film", "Oliver!", { year: 1968, genres: ["musical"], popularity: 0.9 }), card("f2", "film", "The Sound of Music", { year: 1965, genres: ["musical"], popularity: 0.99 }), card("f3", "film", "The Italian Job", { year: 1969, genres: ["crime"], popularity: 0.995 })] }),
      new Map(),
    );
    expect(g.shelves.film.map((x) => x.title)).toEqual(["The Sound of Music", "Oliver!", "The Italian Job"]);
  });
});

describe("IM-5: honest stand-ins", () => {
  const found = [
    { placeId: "pl", type: "song" as const, title: "Anyone Who Had a Heart", by: "Cilla Black", year: 1964, parts: ["60s", "Liverpool", "Qloo"], source: "Qloo: artists of the 60s, popular around Liverpool." },
    { placeId: "pl", type: "film" as const, title: "The Sound of Music", year: 1965, parts: ["film", "1965", "Qloo"], source: "Qloo: films from 1956–76, popular around Liverpool." },
  ];

  it("moves a top pick of the same kind into a labelled stand-in, one card", () => {
    const pool = [...found];
    const out = standInsFor([{ title: "The Zzz Singers", type: "artist" }, { title: "A Zzz Film", type: "film" }, { title: "Zzz Show", type: "tv" }], pool, "Liverpool", "Joan");
    expect(out.map((d) => [d.standIn, d.title])).toEqual([
      ["The Zzz Singers", "Anyone Who Had a Heart"],
      ["A Zzz Film", "The Sound of Music"],
    ]);
    expect(pool).toHaveLength(0);
  });

  it("reads as a stand-in in the gallery, and stays a new try", () => {
    const g = galleryOf(joan({ "stand-ins": [card("x1", "song", "Anyone Who Had a Heart", { by: "Cilla Black", year: 1964, standIn: "The Zzz Singers", source: "Stand-in: Qloo didn’t know ‘The Zzz Singers’, so this is a top pick from Joan’s years in Liverpool." })] }), new Map());
    expect(g.newTries[0].hook).toBe("Couldn’t find ‘The Zzz Singers’ on Qloo. A stand-in from the same years and town: Anyone Who Had a Heart.");
    expect(g.newTries[0].why).toBe("Qloo didn’t know ‘The Zzz Singers’, so this is a top pick from Joan’s years in Liverpool. A stand-in: it stays a new try until a log shows it works.");
  });
});
