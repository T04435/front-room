import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { birthYearOf, extractionSchema, type Fact, type Person } from "@/lib/person";
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
Don't record pronouns, surnames, addresses, diagnoses or medication, even if said.

followUps: one or two short, warm questions for the teller (the family or carer, not the person) that dig into what they just said, toward what a "This is me" still lacks: the years at a place, what they did there, the songs at a dance or a wedding, what they loved, what calms or upsets them. Ground them in their words ("You said they moved to Blackpool when they married. What did they do there?"). Use the person's name or "they". Never ask about anything painful they mentioned. Write the follow-ups in the language the teller used (Spanish if they wrote Spanish).

The teller may write in any language: extract the facts the same way, keeping names, titles and quotes as they wrote them.`;

/** The facts in what someone told us. Nothing is saved here: the page shows them as "here's what I heard" to confirm. */
export async function extractFacts(text: string, person: Person, abortSignal?: AbortSignal): Promise<{ facts: Fact[]; followUps: string[] }> {
  const model = offline() ? offlineExtractor(text, person) : MODELS.curator;
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
    ).output;
  // Never ask what's already in their story (seen offline, QA-8; a guard for the model too).
  const asksKnown = (q: string) => (person.places.length > 0 && /where did .* grow up/i.test(q)) || (birthYearOf(person) !== null && /when (was|were) .* born/i.test(q));
  const tidy = (o: { facts: Fact[]; followUps: string[] }) => ({ facts: clean(o.facts, text), followUps: o.followUps.filter((q) => q.trim() && !/remember/i.test(q) && !asksKnown(q)).slice(0, 2) });
  try {
    return tidy(await once());
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || abortSignal?.aborted) throw error;
    return tidy(await once());
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
function offlineExtractor(text: string, person: Person): LanguageModel {
  const facts: Fact[] = [];
  const f = (kind: Fact["kind"], value: string, quote: string, more: Partial<Fact> = {}) =>
    facts.push({ kind, value, quote, fromYear: null, toYear: null, detail: null, extra: null, ...more });
  if (SPANISH.test(text)) return mockReply(offlineSpanish(text, person));
  const born = text.match(/born (?:in )?(19\d\d)/i);
  if (born) f("birthYear", born[1], born[0], { fromYear: Number(born[1]) });
  // "married in '68" or "married in 1965" (the second was read as 1919).
  const married = text.match(/married(?: [A-Z][a-z]+)? in '?(19\d\d|\d\d)\b/i);
  const marriedYear = married ? (married[1].length === 4 ? Number(married[1]) : 1900 + Number(married[1])) : null;
  const grew = text.match(/grew up in ([A-Z][a-z]+)/);
  if (grew) f("place", grew[1], grew[0], { fromYear: born ? Number(born[1]) : null, toYear: marriedYear, detail: "grew up" });
  const moved = text.match(/moved to ([A-Z][a-z]+)/);
  if (moved) f("place", moved[1], moved[0], { fromYear: marriedYear, detail: "lived" });
  if (married) f("moment", "Married", married[0], { fromYear: marriedYear, detail: "wedding" });
  // Stop at "and …", so the quote is just the dancing ("danced at the Cavern every Saturday").
  const danced = text.match(/danced at the ([A-Z][a-z]+)(?: every [A-Za-z]+| on [A-Za-z]+s)?/i);
  if (danced) f("moment", `Danced at the ${danced[1]}`, danced[0], { detail: "dance", extra: `the ${danced[1]}` });
  const brother = text.match(/(brother|sister) ([A-Z][a-z]+)/);
  if (brother && /died|never talks|don't mention|upset/i.test(text)) f("painful", `${brother[1][0].toUpperCase()}${brother[1].slice(1)} ${brother[2]}`, brother[0]);
  const spoke = text.match(/(?:speaking|spoke|speaks) ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/);
  if (spoke) f("language", spoke[1], spoke[0]);
  const sang = text.match(/(?:always sang|danced to) ([^.,]+?)(?: by ([A-Z][\w .']+?))?(?:[.,]|$)/i);
  if (sang) f("love", sang[1].trim().replace(/^["“]|["”]$/g, ""), sang[0], { detail: "song", extra: sang[2]?.trim() ?? null });
  const worked = text.match(/worked (?:in|at|as) ([^.,]+)/i);
  if (worked) f("work", worked[1].trim(), worked[0]);
  const loved = text.match(/loved ([A-Z][\w ]+?)(?: and |[.,]|$)/);
  if (loved) f("love", loved[1].trim(), loved[0], { detail: "artist" });
  return mockReply({ facts, followUps: offlineFollowUps(moved?.[1], loved?.[1]?.trim(), grew !== null || person.places.length > 0) });
}

function mockReply(output: { facts: Fact[]; followUps: string[] }): LanguageModel {
  return new MockLanguageModelV4({
    modelId: "offline-extractor",
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
      warnings: [],
    }),
  });
}

/** Spanish: families tell the story in their own language. The live model reads any language; offline needs patterns. */
const SPANISH = /\b(naci[óo]|creci[óo]|se cri[óo]|se cas[óo]|se mud[óo]|se fue a vivir|le encantaba|le gustaba|hermano|hermana|trabaj[óo]|bailaba|hablaba)\b/i;
const NAME = "([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]+(?: (?:de )?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]+)*)";

function offlineSpanish(text: string, person: Person): { facts: Fact[]; followUps: string[] } {
  const facts: Fact[] = [];
  const f = (kind: Fact["kind"], value: string, quote: string, more: Partial<Fact> = {}) =>
    facts.push({ kind, value, quote, fromYear: null, toYear: null, detail: null, extra: null, ...more });
  const year = (y: string) => (y.length === 2 ? 1900 + Number(y) : Number(y));
  const born = text.match(/naci[óo] (?:en )?(?:el (?:año )?)?(19\d\d)/i);
  if (born) f("birthYear", born[1], born[0], { fromYear: Number(born[1]) });
  const married = text.match(/se cas[óo] (?:en )?(?:el )?(?:año )?'?(19\d\d|\d\d)\b/i);
  const marriedYear = married ? year(married[1]) : null;
  const grew = text.match(new RegExp(`(?:creci[óo]|se cri[óo]) en ${NAME}`));
  if (grew) f("place", grew[1], grew[0], { fromYear: born ? Number(born[1]) : null, toYear: marriedYear, detail: "grew up" });
  const moved = text.match(new RegExp(`(?:se mud[óo]|se fue a vivir) a ${NAME}`));
  if (moved) f("place", moved[1], moved[0], { fromYear: marriedYear, detail: "lived" });
  if (married) f("moment", "Se casó", married[0], { fromYear: marriedYear, detail: "wedding" });
  const danced = text.match(new RegExp(`bailaba en (?:el |la )?${NAME}`));
  if (danced) f("moment", `Bailaba en ${danced[1]}`, danced[0], { detail: "dance", extra: danced[1] });
  const sibling = text.match(/(hermano|hermana) ([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/);
  if (sibling && /muri[óo]|falleci[óo]|no habla de|no menciona|le duele/i.test(text)) f("painful", `${sibling[1][0].toUpperCase()}${sibling[1].slice(1)} ${sibling[2]}`, sibling[0]);
  const spoke = text.match(/hablaba (español|catalán|gallego|euskera|inglés|portugués)/i);
  if (spoke) f("language", spoke[1][0].toUpperCase() + spoke[1].slice(1), spoke[0]);
  const worked = text.match(/trabaj[óo] (?:en|como|de) ([^.,]+)/i);
  if (worked) f("work", worked[1].trim(), worked[0]);
  const loved = text.match(new RegExp(`(?:[Ll]e encantaba|[Ll]e gustaba mucho|[Ll]e gustaba) (?:la música de |escuchar a |cantar con )?${NAME}`));
  if (loved) f("love", loved[1].trim(), loved[0], { detail: "artist" });
  const followUps = moved
    ? [`Dijo que se mudó a ${moved[1]}. ¿Qué hacía allí?`]
    : loved
      ? [`Dijo que le encantaba ${loved[1]}. ¿Había una canción que siempre cantaba?`]
      : grew || person.places.length
        ? ["¿Qué le calma cuando está inquieto o inquieta?"]
        : ["¿Dónde creció?"];
  return { facts, followUps };
}

/** The offline stand-in for the model's follow-up: dig into what was said, else ask what's missing, else what calms them. */
function offlineFollowUps(movedTo: string | undefined, loved: string | undefined, placeKnown: boolean): string[] {
  if (movedTo) return [`You said they moved to ${movedTo}. What did they do there?`];
  if (loved) return [`You said they loved ${loved}. Was there a song of theirs they always sang?`];
  if (!placeKnown) return ["Where did they grow up?"];
  return ["What calms them when they're unsettled?"];
}
