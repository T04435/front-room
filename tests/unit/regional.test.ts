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
