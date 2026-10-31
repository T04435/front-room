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
    // One untagged artist call, the warm-up, and it comes before the country-tagged ones (HQ's NotOnQ diagnosis); its
    // answer never fills in (F3: only the warm-up, no decade-anywhere list).
    const artist = calls.filter((c) => c["filter.type"] === "urn:entity:artist" && !c["signal.interests.entities"]);
    const untagged = artist.filter((c) => !String(c["filter.tags"] ?? "").includes(","));
    expect(untagged).toEqual([{ "filter.type": "urn:entity:artist", "filter.tags": "urn:tag:genre:music:60s", "signal.location.query": "Sevilla, Spain", take: 10 }]);
    expect(artist.indexOf(untagged[0])).toBe(0);
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
    const { pickLocality, resolvePlaces } = await import("@/server/locality");
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
    const loc = (name: string, d: string | null) => ({ id: name, name, year: null, finaleYear: null, releaseCountry: null, description: null, disambiguation: d, popularity: null, affinity: null, image: null, genres: [], categories: [], keywords: [], lat: null, lon: null });
    // Qloo's answers in the live probe (31 Oct): none of Amritsar's own is named just "Amritsar", all are in India.
    const amritsar = [loc("Amritsar District", "Punjab, India"), loc("Amritsar I Tahsil", "Amritsar District, Punjab, India"), loc("Hussainpura", "Amritsar District, Punjab, India")];
    const amritsarUK = [loc("United Kingdom", null), loc("Kent", "England, United Kingdom"), loc("Alba / Scotland", "United Kingdom")];
    expect(pickLocality("Amritsar", amritsar, "United Kingdom", amritsarUK)?.name).toBe("Amritsar District");
    // Glasgow: six US towns and one in Costa Rica on its own; the hint search finds the Scottish one.
    const glasgow = [loc("Glasgow", "Barren County, Kentucky, United States"), loc("Glasgow", "Valley County, Montana, United States"), loc("Glasgow", "Costa Rica")];
    expect(pickLocality("Glasgow", glasgow, "United Kingdom", [loc("Glasgow", "Glasgow City, Alba / Scotland, United Kingdom")])?.disambiguation).toMatch(/United Kingdom$/);
    // A bare country or region is never a town's locality.
    expect(pickLocality("Nowhereville", [], "United Kingdom", amritsarUK)).toBeNull();
  });

  it("5. Amrit's loves come from Punjab: 'like Mohammed Rafi' in Bradford asks for Punjabi music, and the stand-in for a film is Indian", async () => {
    const calls: Record<string, unknown>[] = [];
    const amrit = person(
      "Amrit",
      1944,
      [
        { id: "lah", name: "Lahore", fromYear: 1944, toYear: 1947 },
        { id: "amr", name: "Amritsar", fromYear: 1947, toYear: 1965 },
        { id: "bfd", name: "Bradford", fromYear: 1965, toYear: null },
      ],
      { languages: ["Punjabi"], loves: [{ id: "l1", type: "artist", title: "Mohammed Rafi", source: "family" }, { id: "l2", type: "film", title: "Films of Raj Kapoor zzz", source: "family" }] },
    );
    const done = await researchPerson(amrit, () => {}, (log) => calls.push(log.params));
    const like = calls.filter((c) => c["signal.interests.entities"] && c["filter.type"] === "urn:entity:artist");
    expect(like.length).toBeGreaterThan(0);
    expect(like.every((c) => String(c["filter.tags"]).includes("urn:tag:genre:music:punjabi"))).toBe(true);
    const standIn = (done.suggestions["stand-ins"] ?? []).find((s) => s.standIn === "Films of Raj Kapoor zzz");
    expect(standIn?.placeId).toBe("amr");
    expect(standIn?.title).not.toBe("The Sound of Music");
  });
});

describe("no memorials in Places (reminiscence, not grief)", () => {
  it("Amritsar's historic places keep Sri Harmandir Sahib and drop Jallianwala Bagh, offline end to end", async () => {
    const { all } = await run(person("Amrit", 1944, [{ id: "amr", name: "Amritsar", fromYear: 1947, toYear: 1965 }], { languages: ["Punjabi"] }));
    const places = all.filter((s) => s.type === "place").map((s) => s.title);
    expect(places).toContain("Sri Harmandir Sahib");
    expect(places).not.toContain("Jallianwala Bagh");
  });

  it("drops a cemetery and a war memorial, keeps an ordinary Bagh garden, and keeps a place the family named", async () => {
    const { isMemorial } = await import("@/lib/card-words");
    expect(isMemorial("Jallianwala Bagh")).toBe(true);
    expect(isMemorial("Southern Cemetery")).toBe(true);
    expect(isMemorial("Cenotaph", ["war memorial"])).toBe(true);
    expect(isMemorial("Ram Bagh")).toBe(false);
    expect(isMemorial("Shalimar Bagh")).toBe(false);
    const place = (id: string, title: string, more = {}) => ({ id, placeId: "amr", type: "place" as const, title, year: null, parts: ["place", "Amritsar", "Qloo"], source: "Qloo: a long-standing place in Amritsar, still there today.", ...more });
    const p = person("Amrit", 1944, [{ id: "amr", name: "Amritsar", fromYear: 1947, toYear: 1965 }], {
      suggestions: { "amr:1": [place("p1", "Jallianwala Bagh"), place("p2", "Sri Harmandir Sahib"), place("p3", "Ram Bagh"), place("p4", "Glasnevin Cemetery", { fromStory: "Visited her parents at Glasnevin Cemetery" })] },
    });
    const titles = galleryOf(p, new Map()).shelves.place.map((x) => x.title);
    expect(titles).toEqual(expect.arrayContaining(["Sri Harmandir Sahib", "Ram Bagh", "Glasnevin Cemetery"]));
    expect(titles).not.toContain("Jallianwala Bagh");
  });
});

describe("NotOnQ budgets for music calls", () => {
  it("gives an artist call with a music tag at least 20 s and the cold-fill retry; other calls keep theirs", async () => {
    const { musicCallOptions, MUSIC_NOTONQ_MS } = await import("@/server/bell");
    expect(MUSIC_NOTONQ_MS).toBeGreaterThanOrEqual(20_000);
    expect(musicCallOptions({ "filter.type": "urn:entity:artist", "filter.tags": "urn:tag:genre:music:60s,urn:tag:genre:music:spanish" })).toEqual({ notonqTimeoutMs: 20_000, retryFill: true });
    expect(musicCallOptions({ "filter.type": "urn:entity:artist", "filter.tags": "urn:tag:genre:music:60s" }, { notonqTimeoutMs: 25_000 })).toEqual({ notonqTimeoutMs: 25_000, retryFill: true });
    expect(musicCallOptions({ "filter.type": "urn:entity:movie" })).toEqual({});
    expect(musicCallOptions({ "filter.type": "urn:entity:artist", "signal.interests.entities": "x" })).toEqual({});
  });
});

describe("Japan and Brazil (the Kazuko and Severino examples)", () => {
  const at = (country: string, label: string) => ({ query: "", label, country, nation: null, lat: null, lon: null });

  it("ask Qloo for their own music, asked in English", async () => {
    const { countryName, globalIsLocal, localTags } = await import("@/server/locality");
    expect(localTags(at("Japan", "Osaka Prefecture, Japan")).map((t) => t.word)).toEqual(["Japanese", "enka"]);
    expect(localTags(at("Brasil", "Pernambuco, Brasil")).map((t) => t.word)).toEqual(["Brazilian", "MPB", "forró"]);
    expect(countryName(at("Brasil", "Pernambuco, Brasil"))).toBe("Brazil");
    expect(globalIsLocal(at("Japan", "Tokyo, Japan"))).toBe(false);
  });

  it("Japanese loves come from Japan", async () => {
    const { loveOrigin } = await import("@/server/locality");
    expect(loveOrigin({ languages: ["Japanese"], places: [] }, new Map())?.country).toBe("Japan");
  });
});
