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

  it("Joan: the rest of the “This is me” sections (FC-11), and no 'what did they do there' when her work is known", async () => {
    const { facts, followUps } = await extractFacts(EXAMPLES[0].text, person("Joan"));
    expect(kinds(facts)).toEqual(
      expect.arrayContaining([
        "painful:Loud bangs",
        "painful:Being rushed",
        "calms:Holding hands, soft music, and talking about Liverpool",
        "hearing:Hears better on the left side",
        "faith:Church of England",
        "bestTime:Mornings: likes to be up early",
        "greeting:Joan; old friends say Jo",
        "love:Coronation Street",
      ]),
    );
    expect(facts.find((f) => f.value === "Coronation Street")?.detail).toBe("tv");
    expect(followUps.join(" ")).not.toMatch(/what did they do there/i);
  });

  it("two loves in one line, with no dangling 'and'", async () => {
    const { facts } = await extractFacts("She grew up in Leeds and loved Dusty Springfield and The Beatles.", person("Iris"));
    expect(kinds(facts).filter((k) => k.startsWith("love:"))).toEqual(["love:Dusty Springfield", "love:The Beatles"]);
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
