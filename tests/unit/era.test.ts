import { describe, expect, it } from "vitest";
import { decadeShort, eraFor, pickDecadeTag } from "@/lib/era";

describe("the era", () => {
  it("is the years someone was 15 to 25, decades by share", () => {
    expect(eraFor(1950)).toEqual({
      from: 1965,
      to: 1975,
      decades: [
        { start: 1970, short: "70s", years: 6 },
        { start: 1960, short: "60s", years: 5 },
      ],
    });
  });

  it("leads with the decade that holds most of the years", () => {
    expect(eraFor(1944).decades.map((d) => [d.short, d.years])).toEqual([
      ["60s", 10],
      ["50s", 1],
    ]);
  });

  it("names the 2000s in full", () => {
    expect(decadeShort(2000)).toBe("2000s");
    expect(decadeShort(1980)).toBe("80s");
  });
});

describe("pickDecadeTag", () => {
  const tags = [
    { id: "urn:tag:genre:music:60s_rock", name: "60s Rock" },
    { id: "urn:tag:genre:music:60s", name: "60s" },
    { id: "urn:tag:genre:music:eighties", name: "Eighties" },
  ];
  it("takes the decade's own tag, not a subgenre", () => {
    expect(pickDecadeTag(tags, 1960)?.id).toBe("urn:tag:genre:music:60s");
  });
  it("knows the worded form", () => {
    expect(pickDecadeTag(tags, 1980)?.id).toBe("urn:tag:genre:music:eighties");
  });
  it("is null when there is none", () => {
    expect(pickDecadeTag(tags, 1950)).toBeNull();
  });
});
