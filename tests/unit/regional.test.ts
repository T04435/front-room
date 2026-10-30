import { describe, expect, it } from "vitest";
import { galleryOf } from "@/lib/gallery";
import { emptyPerson, type Person } from "@/lib/person";
import { researchPerson } from "@/server/bell";

// People from outside the UK (31 Oct): their own country's music, films and TV, never the Anglo hits to fill.
// Offline: the fixtures follow the live probes (NotOnQ's era fill for Spanish 60s artists, Qloo's release country).
const person = (name: string, by: number, places: Person["places"], more: Partial<Person> = {}): Person => ({ ...emptyPerson("abcdefghij", name, null), birthYear: by, places, ...more });
const run = async (p: Person) => {
  const done = await researchPerson(p, () => {}, () => {});
  return { done, g: galleryOf(done, new Map()), all: Object.values(done.suggestions).flat() };
};

describe("regional research (F2–F4, F7)", () => {
  it("Rosa in Sevilla: Spanish artists, Spanish films and TV, no Beatles or Sound of Music", async () => {
    const { all } = await run(person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }]));
    const bys = all.filter((s) => s.type === "song").map((s) => s.by);
    expect(bys).toEqual(expect.arrayContaining(["Raphael", "Marisol", "Julio Iglesias"]));
    expect(bys).not.toContain("The Beatles");
    expect(all.find((s) => s.by === "Raphael")?.parts).toEqual(expect.arrayContaining(["Spanish"]));
    const films = all.filter((s) => s.type === "film").map((s) => s.title);
    expect(films[0]).toBe("Viridiana");
    expect(films).not.toContain("The Sound of Music");
    expect(all.filter((s) => s.type === "tv").map((s) => s.title)).not.toContain("Coronation Street");
  });

  it("asks for the country's films and TV without the place signal (together they return nothing, live)", async () => {
    const calls: Record<string, unknown>[] = [];
    await researchPerson(person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }]), () => {}, (log) => calls.push(log.params));
    const byCountry = calls.filter((c) => c["filter.release_country"]);
    expect(byCountry.length).toBe(2);
    expect(byCountry.every((c) => c["filter.release_country"] === "Spain" && !("signal.location.query" in c))).toBe(true);
    // And no decade-anywhere artist call: another country's music never fills in (F3).
    expect(calls.filter((c) => c["filter.type"] === "urn:entity:artist" && !String(c["filter.tags"] ?? "").includes(",") && !c["signal.interests.entities"])).toEqual([]);
  });

  it("steer clear in Spanish ('ruidos fuertes') hides the western", async () => {
    const steers: Person["steers"] = [{ id: "s", kind: "sound", label: "Ruidos fuertes", level: "never", source: "family", at: "2026-10-31T00:00:00Z" }];
    const { g } = await run(person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }], { steers }));
    expect(g.shelves.film.map((x) => x.title)).not.toContain("The Good, the Bad and the Ugly");
  });

  it("Glasgow keeps British music and the era's films (no country filter in the English-speaking world)", async () => {
    const { all } = await run(person("Isla", 1949, [{ id: "gla", name: "Glasgow", fromYear: 1949, toYear: 1971 }]));
    expect(all.filter((s) => s.type === "song").map((s) => s.by)).toContain("The Beatles");
    expect(all.filter((s) => s.type === "film").map((s) => s.title)).toEqual(["Some Like It Hot", "Breakfast at Tiffany's"]);
  });

  it("Amrit: Punjabi music in Amritsar, British in Bradford, Lahore kept in Pakistan", async () => {
    const { all } = await run(
      person("Amrit", 1944, [
        { id: "lah", name: "Lahore", fromYear: 1944, toYear: 1947 },
        { id: "amr", name: "Amritsar", fromYear: 1947, toYear: 1965 },
        { id: "bfd", name: "Bradford", fromYear: 1965, toYear: null },
      ]),
    );
    const at = (id: string) => all.filter((s) => s.placeId === id && s.type === "song").map((s) => s.by);
    expect(at("amr")).toEqual(expect.arrayContaining(["Mohammed Rafi", "Lata Mangeshkar"]));
    expect(at("amr")).not.toContain("The Beatles");
    expect(at("bfd").length).toBeGreaterThan(0);
    expect(at("bfd")).not.toContain("Mohammed Rafi");
  });
});

describe("the Why line names NotOnQ when it served the pick (F3)", () => {
  it("says 'Found via NotOnQ among Spanish artists…'", async () => {
    const { whyFor } = await import("@/lib/card-words");
    const p = person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }]);
    const why = whyFor(p, { type: "song", title: "Yo soy aquel", by: "Raphael", year: 1966, origin: "qloo", placeId: "sev", parts: ["60s", "Sevilla", "Spanish", "via NotOnQ"], source: "Qloo: Spanish artists of the 60s, popular around Sevilla." });
    expect(why).toBe("Big in Sevilla when Rosa was 18. Found via NotOnQ among Spanish artists of the 60s, popular around Sevilla.");
  });
});

describe("Rosa's live run, 31 Oct (the four bugs)", () => {
  const steers: Person["steers"] = ["Ruidos fuertes", "Quedarse sola por la noche", "Hermano Manuel"].map((label, i) => ({ id: `s${i}`, kind: "topic", label, level: "never", source: "family", at: "2026-10-31T00:00:00Z" }));
  const film = (id: string, title: string, year: number, genres: string[], placeId = "sev") => ({ id, placeId, type: "film" as const, title, year, parts: ["film", String(year), "Qloo"], source: "Qloo: films from 1958–70, popular around Sevilla.", genres });

  it("1. keeps the Spanish films: keyword noise ('spanish civil war', 'murder', 'gun') isn't harsh; a western and a war film are", () => {
    const p = person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }, { id: "mad", name: "Madrid", fromYear: 1970, toYear: 1978 }], {
      steers,
      suggestions: {
        "sev:1958-1970": [film("f1", "The Executioner", 1963, ["comedy", "drama", "murder"]), film("f2", "Chimes at Midnight", 1965, ["drama", "history", "war"])],
        "mad:1970-1978": [film("f3", "The Spirit of the Beehive", 1973, ["drama", "fantasy", "spanish civil war", "gun"], "mad"), film("f4", "Cría Cuervos", 1976, ["drama"], "mad"), film("f5", "Once Upon a Time... Man", 1974, ["spaghetti western"], "mad")],
      },
    });
    const titles = galleryOf(p, new Map()).shelves.film.map((x) => x.title);
    expect(titles).toEqual(expect.arrayContaining(["The Executioner", "The Spirit of the Beehive", "Cría Cuervos"]));
    expect(titles).not.toContain("Once Upon a Time... Man");
    expect(titles).not.toContain("Chimes at Midnight");
  });

  it("2. 'like Rocío Jurado' asks for Spanish music only (decade ∩ spanish)", async () => {
    const calls: Record<string, unknown>[] = [];
    const loves: Person["loves"] = [{ id: "l1", type: "artist", title: "Rocío Jurado", source: "family" }];
    await researchPerson(person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }], { loves }), () => {}, (log) => calls.push(log.params));
    const like = calls.filter((c) => c["signal.interests.entities"] && c["filter.type"] === "urn:entity:artist");
    expect(like.length).toBeGreaterThan(0);
    expect(like.every((c) => String(c["filter.tags"]).includes("urn:tag:genre:music:spanish") && c["operator.filter.tags"] === "intersection")).toBe(true);
  });

  it("3. the local-music call asks for 'Sevilla, Spain' (in English, as NotOnQ's era fill wants it)", async () => {
    const calls: Record<string, unknown>[] = [];
    await researchPerson(person("Rosa", 1948, [{ id: "sev", name: "Sevilla", fromYear: 1958, toYear: 1970 }]), () => {}, (log) => calls.push(log.params));
    const local = calls.find((c) => String(c["filter.tags"] ?? "").endsWith(",urn:tag:genre:music:spanish"));
    expect(local).toMatchObject({ "filter.type": "urn:entity:artist", "operator.filter.tags": "intersection", "signal.location.query": "Sevilla, Spain", take: 8 });
  });

  it("4. Amritsar stays in India with no majority country; an ambiguous name takes the hint", async () => {
    const { ownMatch, resolvePlaces } = await import("@/server/locality");
    const where = await resolvePlaces(
      [
        { id: "lah", name: "Lahore", fromYear: 1944, toYear: 1947 },
        { id: "amr", name: "Amritsar", fromYear: 1947, toYear: 1965 },
        { id: "bfd", name: "Bradford", fromYear: 1965, toYear: null },
      ],
      () => {},
    );
    expect(where.get("amr")?.country).toBe("India");
    expect(where.get("lah")?.country).toBe("Pakistan");
    expect(where.get("bfd")?.country).toBe("United Kingdom");
    const loc = (name: string, d: string) => ({ id: d, name, year: null, finaleYear: null, releaseCountry: null, description: null, disambiguation: d, popularity: null, affinity: null, image: null, genres: [], categories: [], keywords: [], lat: null, lon: null });
    expect(ownMatch("Amritsar", [loc("Amritsar", "Punjab, India")])?.disambiguation).toBe("Punjab, India");
    expect(ownMatch("Glasgow", [loc("Glasgow", "Kentucky, United States"), loc("Glasgow", "Montana, United States"), loc("Glasgow", "Costa Rica")])).toBeNull();
  });
});
