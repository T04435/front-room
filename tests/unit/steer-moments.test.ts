import { describe, expect, it } from "vitest";
import { momentSteered, talkingPoints, withEndYears, type Person, type Steer } from "@/lib/person";

const steer = (label: string): Steer => ({ id: label, kind: "person", label, level: "never", source: "family", at: "2026-10-29T00:00:00Z" });

describe("talking points against steer clear (A3)", () => {
  const p: Pick<Person, "steers" | "moments"> = {
    steers: [steer("Husband Frank")],
    moments: [
      { id: "m1", kind: "wedding", year: 1971, label: "Married" },
      { id: "m2", kind: "dance", year: null, label: "Went dancing at the Barrowland", venue: "Barrowland" },
      { id: "m3", kind: "other", year: 1975, label: "Holidays with Frank in Ayr" },
    ],
  };

  it("drops the wedding when a husband is on steer clear", () => {
    expect(momentSteered(p, p.moments[0])).toBe(true);
    expect(talkingPoints(p).map((m) => m.id)).toEqual(["m2"]);
  });

  it("drops a moment that names the person on steer clear", () => {
    expect(momentSteered(p, p.moments[2])).toBe(true);
  });

  it("keeps the wedding when steer clear is about something else", () => {
    expect(momentSteered({ steers: [steer("The war")] }, p.moments[0])).toBe(false);
  });
});

describe("place end years (A7)", () => {
  it("ends a place with no end year where the next one starts", () => {
    const out = withEndYears([
      { id: "a", name: "Glasgow", fromYear: 1949, toYear: null },
      { id: "b", name: "Blackpool", fromYear: 1971, toYear: null },
      { id: "c", name: "Govan", fromYear: null, toYear: null },
    ]);
    expect(out.map((x) => x.toYear)).toEqual([1971, null, null]);
  });
});
