import { describe, expect, it } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { emptyPerson } from "@/lib/person";
import { extractFacts } from "@/server/extract";

// Offline: the stand-in reader. The live model reads any language; these check the examples run end to end in tests.
describe("the example stories (offline reader)", () => {
  const person = (name: string) => emptyPerson("abcdefghij", name, null);
  const kinds = (facts: { kind: string; value: string }[]) => facts.map((f) => `${f.kind}:${f.value}`);

  it("Joan (English): born, both places, the dancing, the steer-clear and Cilla Black", async () => {
    const { facts } = await extractFacts(EXAMPLES[0].text, person("Joan"));
    expect(kinds(facts)).toEqual(expect.arrayContaining(["birthYear:1946", "place:Liverpool", "place:Leeds", "painful:Brother Tom", "love:Cilla Black"]));
  });

  it("Rosa (Spanish): read in Spanish, with the follow-up in Spanish", async () => {
    const { facts, followUps } = await extractFacts(EXAMPLES[1].text, person("Rosa"));
    expect(kinds(facts)).toEqual(expect.arrayContaining(["birthYear:1948", "place:Sevilla", "place:Madrid", "painful:Hermano Manuel", "love:Rocío Jurado"]));
    expect(facts.every((f) => f.quote.length > 0)).toBe(true);
    expect(followUps[0]).toMatch(/^Dijo que se mudó a Madrid/);
  });

  it("Amrit (Amritsar, Punjabi): born, the place and the language", async () => {
    const { facts } = await extractFacts(EXAMPLES[2].text, person("Amrit"));
    expect(kinds(facts)).toEqual(expect.arrayContaining(["birthYear:1944", "place:Amritsar", "place:Bradford", "language:Punjabi"]));
  });
});
