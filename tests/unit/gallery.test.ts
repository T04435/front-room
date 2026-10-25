import { describe, expect, it } from "vitest";
import { EXAMPLE_PERSON, EXAMPLE_PLAYS } from "@/lib/example-person";
import { calmPick, galleryOf } from "@/lib/gallery";
import { playStats } from "@/lib/learning";
import { emptyPerson, type Person } from "@/lib/person";

const NOW = new Date("2026-10-25T12:00:00Z");

describe("a person's gallery (the example Margaret)", () => {
  const g = galleryOf(EXAMPLE_PERSON, playStats(EXAMPLE_PLAYS, [], NOW, "Europe/London"));
  const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

  it("puts what's proven in Works for them, and new tries on their own shelf", () => {
    expect(titles(g.works)).toEqual(expect.arrayContaining(["Waterloo", "You Don't Have to Say You Love Me"]));
    expect(g.newTries.length).toBe(3);
    expect(g.newTries.every((x) => x.origin === "new_try")).toBe(true);
  });

  it("keeps paused and resting items off the shelves", () => {
    expect(titles(g.paused)).toContain("Yesterday");
    expect(titles(g.resting)).toContain("Lola");
    const shelved = Object.values(g.shelves).flat();
    expect(titles(shelved)).not.toContain("Yesterday");
    expect(titles(shelved)).not.toContain("Lola");
  });

  it("links songs to Spotify and YouTube, and hosts nothing", () => {
    const song = g.shelves.song[0];
    expect(song.links.map((l) => l.label)).toEqual(["Spotify", "YouTube"]);
    expect(song.links.every((l) => l.href.startsWith("https://"))).toBe(true);
  });

  it("finds something calm now, never the item just stopped", () => {
    const pick = calmPick(g)!;
    expect(pick.type).toBe("song");
    expect(calmPick(g, pick.key)?.key).not.toBe(pick.key);
  });
});

describe("something calm", () => {
  it("is never guessed: with no Calm logged there's no pick (QA-1)", () => {
    const p: Person = {
      ...emptyPerson("abcdefghij", "Iris", null),
      suggestions: { "pl:1": [{ id: "c1", placeId: "pl", type: "song", title: "Bus Stop", by: "The Hollies", year: 1966, parts: [], source: "Qloo" }] },
    };
    expect(calmPick(galleryOf(p, new Map()))).toBeNull();
  });

  it("puts the songs for artists the family named on the shelf as the family's", () => {
    const p: Person = {
      ...emptyPerson("abcdefghij", "Iris", null),
      suggestions: {
        "pl:1": [{ id: "c1", placeId: "pl", type: "song", title: "Bus Stop", by: "The Hollies", year: 1966, parts: [], source: "Qloo" }],
        family: [{ id: "f1", placeId: "family", type: "song", title: "Anyone Who Had a Heart", by: "Cilla Black", year: 1964, parts: ["the family"], source: "The family said Iris loved Cilla Black." }],
      },
    };
    const songs = galleryOf(p, new Map()).shelves.song;
    expect(songs[0]).toMatchObject({ title: "Anyone Who Had a Heart", origin: "family" });
  });
});

describe("steer clear", () => {
  it("never shows a suggestion that names something to steer clear of", () => {
    const p: Person = {
      ...emptyPerson("abcdefghij", "Iris", null),
      steers: [{ id: "s1", kind: "person", label: "Tom", level: "never", source: "family", at: NOW.toISOString() }],
      suggestions: {
        "pl:1": [
          { id: "c1", placeId: "pl", type: "song", title: "Tom Dooley", by: "The Kingston Trio", year: 1958, parts: [], source: "Qloo" },
          { id: "c2", placeId: "pl", type: "song", title: "Bus Stop", by: "The Hollies", year: 1966, parts: [], source: "Qloo" },
          { id: "c3", placeId: "pl", type: "song", title: "Waterloo", by: "ABBA", year: 1974, parts: [], source: "Qloo", answer: "upset" },
        ],
      },
    };
    const g = galleryOf(p, new Map());
    expect(g.shelves.song.map((x) => x.title)).toEqual(["Bus Stop"]);
  });
});
