import { describe, expect, it } from "vitest";
import { careNote } from "@/lib/care-note";
import { EXAMPLE_KITS } from "@/lib/example-person";
import { completeness, emptyPerson, eraForPlace, missingMinimum, steersClear, type Fact } from "@/lib/person";
import { addSteer, applyFact, wouldHelpNext } from "@/lib/story";

const fact = (kind: Fact["kind"], value: string, more: Partial<Fact> = {}): Fact => ({ kind, value, fromYear: null, toYear: null, detail: null, extra: null, quote: "", ...more });

describe("the story", () => {
  it("needs a preferred name, a birth year or decade, and one place", () => {
    let p = emptyPerson("abcdefghij", "Maggie", null);
    expect(missingMinimum(p)).toEqual(["birthYear", "place"]);
    p = applyFact(p, fact("decade", "1950"));
    p = applyFact(p, fact("place", "Manchester", { fromYear: 1950, toYear: 1972, detail: "grew up" }));
    expect(missingMinimum(p)).toEqual([]);
    expect(completeness(p)).toBeGreaterThan(0);
  });

  it("merges a place said twice, filling in its years", () => {
    let p = applyFact(emptyPerson("abcdefghij", "M", null), fact("place", "Blackpool"));
    p = applyFact(p, fact("place", "blackpool", { fromYear: 1972 }));
    expect(p.places).toHaveLength(1);
    expect(p.places[0].fromYear).toBe(1972);
  });

  it("keeps only the label of a steer-clear, and No need keeps nothing", () => {
    let p = addSteer(emptyPerson("abcdefghij", "M", null), "Brother Tom", "never", "person");
    expect(p.steers.map((s) => [s.label, s.level])).toEqual([["Brother Tom", "never"]]);
    p = addSteer(p, "The war", "no_need");
    expect(p.steers).toHaveLength(1);
    expect(p.steerAsked).toBe(true);
    expect(steersClear(p, "A song for brother Tom")).toBe(true);
    expect(steersClear(p, "Waterloo")).toBe(false);
  });

  it("puts an unresolved upset first in what would help next", () => {
    const p = applyFact(emptyPerson("abcdefghij", "Margaret", null), fact("place", "Manchester", { fromYear: 1950 }));
    const helps = wouldHelpNext(p, [{ key: "song:yesterday|the beatles", title: "Yesterday", lastUpsetAt: "2026-10-24T18:25:00Z" }], 0);
    expect(helps[0]).toMatchObject({ kind: "upset" });
    expect(helps.map((h) => h.kind)).toEqual(expect.arrayContaining(["steer", "place", "moment", "calms", "work", "faith", "hearing"]));
  });
});

describe("the era for a place", () => {
  it("is the overlap with ages 10–30", () => {
    expect(eraForPlace({ fromYear: 1950, toYear: 1972 }, 1950, 2026)).toEqual({ from: 1960, to: 1972 });
  });
  it("is the place's own years for a later chapter", () => {
    expect(eraForPlace({ fromYear: 1995, toYear: null }, 1950, 2026)).toEqual({ from: 1995, to: 2010 });
  });
  it("is ages 10–30 for a place with no years", () => {
    expect(eraForPlace({ fromYear: null, toYear: null }, 1950, 2026)).toEqual({ from: 1960, to: 1980 });
  });
});

describe("the care note", () => {
  it("records observations in one line", () => {
    const kit = EXAMPLE_KITS[0];
    const note = careNote(kit, [
      { id: 1, response: "engaged", itemRef: "S2", at: "2026-10-20T10:32:00Z" },
      { id: 2, response: "sang", itemRef: "S5", at: "2026-10-20T10:40:00Z" },
    ], "2026-10-20T10:30:00Z", "2026-10-20T10:42:00Z");
    expect(note).toMatch(/12 min Chat\. Engaged from track 2, sang along to Waterloo\. No distress\.$/);
  });
});
