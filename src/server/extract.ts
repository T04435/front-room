import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { extractionSchema, type Fact, type Person } from "@/lib/person";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

export const EXTRACT_RULES = `You read what a family member, carer or the person themselves said about someone living with dementia, and list the facts in it, for a "This is me"-style life story that care staff use in music and reminiscence sessions.

Extract only. Never fill gaps, guess, or add anything that wasn't said. If a year isn't said, use null.

Kinds:
- preferredName: the name they like to be called.
- birthYear: the year they were born (fromYear). decade: when only the decade is said, e.g. "born in the fifties" → fromYear 1950.
- place: a town or city they lived in (value: the place name as said; fromYear/toYear: the years there if said; detail: "grew up", "lived", "worked"). Work out years from what's said: "born 1950 in Manchester, moved to Blackpool when she married in '72" → Manchester 1950–1972, Blackpool 1972–null.
- moment: a big moment (detail: wedding, dance, move, service, other; value: a short label in the teller's sense, e.g. "Danced at the Ritz every Saturday"; fromYear: the year if said; extra: the venue if said).
- love: something they loved (detail: song, artist, film, tv, place, team, dance, other; value: the title or name; extra: a song's artist if said; fromYear: a year if said).
- painful: anyone or anything that could upset them, or that the family wouldn't want raised: a death, a war, an estranged person, a sound. value: a SHORT neutral label only, e.g. "Brother Tom", "The war", "Loud bangs". No reason, no detail.
- calms: what calms or settles them. upsets: things that upset them in daily life (not a person or event; those are painful).
- work: jobs, trades, skills. faith: faith or festivals they keep (or "keep it out"). hearing: hearing and headphones. language: languages they speak. greeting: how they like to be greeted. bestTime: their best time of day.

Every fact has a quote: the teller's own words it came from, short (under 15 words), copied exactly.
Don't record pronouns, surnames, addresses, diagnoses or medication, even if said.`;

/** The facts in what someone told us. Nothing is saved here: the page shows them as "here's what I heard" to confirm. */
export async function extractFacts(text: string, person: Person, abortSignal?: AbortSignal): Promise<Fact[]> {
  const model = offline() ? offlineExtractor(text) : MODELS.curator;
  const known = [
    person.preferredName ? `Name they like: ${person.preferredName}` : null,
    person.birthYear ? `Born ${person.birthYear}` : null,
    person.places.length ? `Places already known: ${person.places.map((p) => `${p.name} ${p.fromYear ?? "?"}–${p.toYear ?? "?"}`).join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const prompt = `${EXTRACT_RULES}\n\n${known ? `Already in their story (don't repeat these unless the teller adds something new):\n${known}\n\n` : ""}What the teller said:\n"""\n${text}\n"""`;
  const once = async () =>
    (
      await generateText({
        model,
        output: Output.object({ schema: extractionSchema }),
        prompt,
        maxOutputTokens: 3000,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.curatorTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output.facts;
  try {
    return clean(await once(), text);
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || abortSignal?.aborted) throw error;
    return clean(await once(), text);
  }
}

/** Drops facts with nothing in them, and quotes that aren't in the text (the model must quote, not invent). */
function clean(facts: Fact[], text: string): Fact[] {
  const flat = text.toLowerCase().replace(/\s+/g, " ");
  return facts
    .filter((f) => f.value.trim())
    .map((f) => ({ ...f, value: f.value.trim(), quote: flat.includes(f.quote.toLowerCase().replace(/\s+/g, " ").trim()) ? f.quote.trim() : "" }));
}

/**
 * Offline (tests and e2e): a few patterns stand in for the model, enough for the demo story ("born 1950", "grew up in
 * Manchester", "married in '72 and moved to Blackpool", "brother Tom … never talks about him", "loved Dusty").
 */
function offlineExtractor(text: string): LanguageModel {
  const facts: Fact[] = [];
  const f = (kind: Fact["kind"], value: string, quote: string, more: Partial<Fact> = {}) =>
    facts.push({ kind, value, quote, fromYear: null, toYear: null, detail: null, extra: null, ...more });
  const born = text.match(/born (?:in )?(19\d\d)/i);
  if (born) f("birthYear", born[1], born[0], { fromYear: Number(born[1]) });
  const married = text.match(/married in '?(\d\d)/i);
  const marriedYear = married ? 1900 + Number(married[1]) : null;
  const grew = text.match(/grew up in ([A-Z][a-z]+)/);
  if (grew) f("place", grew[1], grew[0], { fromYear: born ? Number(born[1]) : null, toYear: marriedYear, detail: "grew up" });
  const moved = text.match(/moved to ([A-Z][a-z]+)/);
  if (moved) f("place", moved[1], moved[0], { fromYear: marriedYear, detail: "lived" });
  if (married) f("moment", "Married", married[0], { fromYear: marriedYear, detail: "wedding" });
  const danced = text.match(/danced at the ([A-Z][a-z]+)[^.]*/i);
  if (danced) f("moment", `Danced at the ${danced[1]}`, danced[0], { detail: "dance", extra: `the ${danced[1]}` });
  const brother = text.match(/(brother|sister) ([A-Z][a-z]+)/);
  if (brother && /died|never talks|don't mention|upset/i.test(text)) f("painful", `${brother[1][0].toUpperCase()}${brother[1].slice(1)} ${brother[2]}`, brother[0]);
  const loved = text.match(/loved ([A-Z][\w ]+?)(?:[.,]|$)/);
  if (loved) f("love", loved[1].trim(), loved[0], { detail: "artist" });
  return new MockLanguageModelV4({
    modelId: "offline-extractor",
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify({ facts }) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
      warnings: [],
    }),
  });
}
