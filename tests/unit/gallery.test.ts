import { describe, expect, it } from "vitest";
import { EXAMPLE_PERSON, EXAMPLE_PLAYS } from "@/lib/example-person";
import { harshKeywords, pickVenue } from "@/lib/card-words";
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

  it("covers films and TV by genre and keyword: no Rocky (boxing) when steer clear says loud bangs", () => {
    // Rocky's only Qloo genre is drama; its keywords say boxing (kept with the genres at research time).
    const genres = ["drama", ...harshKeywords(["young couple", "boxing", "persistence"])];
    const film = (id: string, title: string, gs: string[]) => ({ id, placeId: "pl", type: "film" as const, title, year: 1976, parts: [], source: "Qloo", genres: gs });
    const base: Person = {
      ...emptyPerson("abcdefghij", "Joan", null),
      suggestions: { "pl:1": [film("f1", "Rocky", genres), film("f2", "Grease", ["musical", "romance"])] },
    };
    const steer = (label: string) => ({ ...base, steers: [{ id: "s1", kind: "sound" as const, label, level: "never" as const, source: "family" as const, at: NOW.toISOString() }] });
    expect(galleryOf(steer("Loud bangs"), new Map()).shelves.film.map((x) => x.title)).toEqual(["Grease"]);
    expect(galleryOf(steer("Boxing"), new Map()).shelves.film.map((x) => x.title)).toEqual(["Grease"]);
    expect(galleryOf(base, new Map()).shelves.film.map((x) => x.title)).toContain("Rocky");
  });
});

describe("a venue named in the story (Joan's Cavern)", () => {
  // Qloo's search for "Cavern Liverpool", in its order (29 Oct): a hotel in the Cavern Quarter comes first.
  const results = [
    { name: "ibis Styles Liverpool Centre Dale Street - Cavern Quarter", categories: ["hotel"] },
    { name: "The Cavern Club", categories: ["tourist attraction", "restaurant", "live music venue", "bar"] },
    { name: "Revolution Cavern Quarter", categories: ["cocktail bar", "restaurant"] },
    { name: "Cavern Walks - Shopping Centre", categories: ["shopping mall"] },
  ];

  it("takes the real venue, never the hotel nearby", () => {
    expect(pickVenue("the Cavern", results)?.name).toBe("The Cavern Club");
  });

  it("drops the place when no hit is a sure match", () => {
    expect(pickVenue("the Cavern", [results[0], results[2], results[3]])).toBeNull();
    expect(pickVenue("Cavern", [{ name: "ibis Cavern Hotel", categories: [] }])).toBeNull();
    expect(pickVenue("Barrowland", [{ name: "Barrowland Ballroom", categories: ["music venue"] }])?.name).toBe("Barrowland Ballroom");
  });
});

describe("one card per place (FC-4)", () => {
  it("merges 'the Cavern Liverpool' into 'The Cavern Club', with the story's badge and reason", () => {
    const p: Person = {
      ...emptyPerson("abcdefghij", "Joan", null),
      places: [{ id: "pl", name: "Liverpool", fromYear: 1946, toYear: 1968 }],
      moments: [{ id: "m1", kind: "dance", year: null, label: "Danced at the Cavern", venue: "the Cavern" }],
      suggestions: {
        story: [{ id: "s1", placeId: "pl", type: "place", title: "the Cavern Liverpool", year: null, parts: ["their story", "Liverpool", "Qloo"], source: "Named in Joan’s story.", fromStory: "Danced at the Cavern" }],
        "pl:1956-1968": [{ id: "q1", placeId: "pl", type: "place", title: "The Cavern Club", year: null, parts: ["place", "Liverpool", "Qloo"], source: "Qloo: a long-standing place in Liverpool, still there today." }],
      },
    };
    const places = galleryOf(p, new Map()).shelves.place;
    expect(places.map((x) => x.title)).toEqual(["The Cavern Club"]);
    expect(places[0].story).toBe("Danced at the Cavern");
    expect(places[0].why).toBe("The family mentioned it: “Danced at the Cavern”. Found by Qloo in Liverpool.");
  });
});

describe("Product's v2.3 rules (the example Margaret, who has 'Loud bangs' in steer clear)", () => {
  const g = galleryOf(EXAMPLE_PERSON, playStats(EXAMPLE_PLAYS, [], NOW, "Europe/London"));
  const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

  it("PR-1: no crime, war or prison films and TV when steer clear says loud bangs; gentle ones lead", () => {
    expect(titles(g.shelves.film)).not.toContain("The Godfather");
    expect(titles(g.shelves.film)).not.toContain("Papillon");
    expect(titles(g.shelves.tv)).not.toContain("Columbo");
    expect(g.shelves.film[0].title).toBe("The Sound of Music");
    expect(titles(g.shelves.tv)).toContain("Fawlty Towers");
  });

  it("PR-2: every card has a hook tied to her and an open prompt, never 'remember'", () => {
    const all = [...g.works, ...g.newTries, ...Object.values(g.shelves).flat()];
    expect(all.every((x) => x.hook.length > 10 && x.prompt.ask.endsWith("?") && !/remember/i.test(x.prompt.ask + x.hook))).toBe(true);
    expect(g.shelves.film[0].hook).toBe("Out in 1965, when Margaret was 15 and living in Manchester.");
  });

  it("PR-4: films offer a song from them, TV the theme tune", () => {
    expect(g.shelves.film[0].links[0].label).toBe("Play “Edelweiss”");
    expect(g.shelves.tv.find((x) => x.title === "Fawlty Towers")!.links[0].label).toBe("Play the theme");
  });

  it("PR-5: the place from her story first, no universities or research libraries", () => {
    expect(g.shelves.place[0]).toMatchObject({ title: "The Ritz, Manchester", story: "Danced at the Ritz every Saturday" });
    expect(titles(g.shelves.place).some((t) => /universit|research/i.test(t))).toBe(false);
  });
});

describe("why each card is here (A6, A8)", () => {
  const base: Person = {
    ...emptyPerson("why-test-1", "Edie", null),
    birthYear: 1949,
    places: [{ id: "gla", name: "Glasgow", fromYear: 1949, toYear: 1971 }],
    moments: [{ id: "m", kind: "dance", year: null, label: "Went dancing at the Barrowland", venue: "Barrowland" }],
    suggestions: {
      "gla:1959-1971": [
        { id: "s1", placeId: "gla", type: "song", title: "Dancing Queen", by: "ABBA", year: 1976, parts: ["70s", "Glasgow", "Qloo", "MusicBrainz"], source: "Qloo: artists popular around Glasgow in the 70s." },
        { id: "s2", placeId: "gla", type: "song", title: "Shout", by: "Lulu", year: 1964, parts: ["60s", "Glasgow", "Scottish", "Qloo", "MusicBrainz"], source: "Qloo: Scottish artists of the 60s, popular around Glasgow." },
      ],
      story: [{ id: "s3", placeId: "gla", type: "place", title: "Barrowland Ballroom", year: null, parts: ["their story", "Glasgow", "Qloo"], source: "Named in Edie’s story; Qloo found the place in Glasgow.", fromStory: "Went dancing at the Barrowland" }],
    },
  };
  const g = galleryOf(base, new Map());
  const find = (t: string) => [...Object.values(g.shelves).flat()].find((x) => x.title === t)!;

  it("says 'from their story' only for what the story names", () => {
    expect(find("Dancing Queen").story).toBeUndefined();
    expect(find("Barrowland Ballroom").story).toBe("Went dancing at the Barrowland");
  });

  it("says plainly what Qloo matched", () => {
    expect(find("Shout").why).toBe("Big in Glasgow when Edie was 15. Found by Qloo (Scottish artists of the 60s, popular around Glasgow); a real recording, checked on MusicBrainz.");
    expect(find("Shout").whyShort).toBe("Glasgow · Scottish 60s");
    expect(find("Barrowland Ballroom").why).toContain("The family mentioned it");
  });
});
