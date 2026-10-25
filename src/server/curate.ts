import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describeEra, type Era } from "@/lib/era";
import { curatedSchema, type Curated, type KitItem } from "@/lib/kit";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

const TYPE: Record<KitItem["type"], string> = { song: "song", artist: "artist", film: "film", tv: "TV", place: "place", book: "book", family: "from the family" };

export const CURATOR_RULES = `You set out a 20-minute reminiscence session that care staff or family will share with an older person, from research on the music, films, TV and places of the years they were 15 to 25, where they grew up. The session: about 12 minutes of songs, 5 minutes on a film and a TV show, 3 minutes on a place from home, and things to talk about.

Songs:
- 4 or 5 songs. Each cites one artist ref from the research (an "artist" item), at most one song per artist.
- Name ONE well-known recording by that artist, released in or close to the era years given, by its exact title. Prefer the songs people of that time and place would have heard most (the hits, the dance-hall and radio favourites). Never invent a title; if you're not sure of a recording by an artist, leave that artist out.
- Order: "calm" first (gentle, slower, 1–2 songs), then "familiar" (the best-known, 1–2), then "singalong" (big choruses everyone knows, 1–2).
- "why" is one short line for staff, about the song in that place and time.

Picks:
- One film and one TV show from the research, the ones someone of that age there would most likely have seen.
- One or two places from the research: today's places that were already there in their youth (an old theatre, a dance hall, a library, a ground). Skip anything that's clearly new. They're to talk about, not to visit.
- "why" is one short line for staff on how to bring it up.

Things to talk about:
- 4 or 5 prompts staff can say out loud, each citing the refs of the items it mentions (an artist, the film, the TV show, the place, something from the family). Mix them: not only music.
- Gentle, open questions that invite a story or an opinion ("Did you see The Sound of Music at the pictures? Who did you go with?"). Never test memory: never use the word "remember", no quiz questions, no correcting.
- "reply" is what they might answer, so new staff know what to listen for ("They might name a friend, a cinema, or sing a line"). One short line.
- Mention the hometown where it helps.

Rules:
- Use only refs from the research list. Items marked "from the family" are things the family told us: weave them in.
- Sharing and engagement, never treatment: no medical or therapeutic claims ("therapy", "improves memory" and the like).
- Lines for staff ("why", "reply") refer to the person by their name, or as "they". Never guess pronouns from a name.
- Plain, warm and short. British English ("the pictures", "the telly", "favourite") for a UK place, plain American English for a US place, otherwise plain international English. No emoji.`;

function researchList(items: KitItem[]): string {
  return items.map((i) => `${i.ref} [${TYPE[i.type]}] ${i.title}${i.year ? ` (${i.year})` : ""}${i.description ? ` · ${i.description}` : ""}: ${i.source}`).join("\n");
}

export function curatorPrompt(input: { place: string; era: Era; name?: string; items: KitItem[]; avoid?: string[] }): string {
  const who = input.name ? `${input.name}, who` : "Someone who";
  return `${who} grew up in ${input.place} and was 15 to 25 in ${describeEra(input.era)}.

Research (ref [kind] name (year): source):
${researchList(input.items)}${input.avoid?.length ? `\n\nThe family said these aren't for them; leave them out: ${input.avoid.join("; ")}` : ""}

${CURATOR_RULES}`;
}

/**
 * Offline (tests and e2e): a fixed curator that builds a valid kit from the research, so no model is called. It names
 * placeholder songs, never real titles, so a fixture can't be mistaken for a pick.
 */
function offlineCurator(items: KitItem[]): LanguageModel {
  const artists = items.filter((i) => i.type === "artist").slice(0, 5);
  const screen = [items.find((i) => i.type === "film"), items.find((i) => i.type === "tv")].filter((i): i is KitItem => Boolean(i));
  const places = items.filter((i) => i.type === "place").slice(0, 1);
  const phases = ["calm", "familiar", "familiar", "singalong", "singalong"] as const;
  const curated: Curated = {
    songs: artists.map((a, n) => ({ artistRef: a.ref, title: `Test song ${n + 1}`, year: a.year, phase: phases[n] ?? "singalong", why: `Offline fixture for ${a.title}.` })),
    picks: [...screen, ...places].map((i) => ({ ref: i.ref, why: `Offline fixture: ask about ${i.title}.` })),
    prompts: [...screen, ...places, ...artists.slice(0, 2)].map((i) => ({ text: `Did you ever see or hear ${i.title}? Who were you with?`, reply: "They might name a friend, a place, or hum a line.", refs: [i.ref] })),
    summary: "Offline fixture kit: gentle songs first, a film, the telly and a place to talk about, singalongs to finish.",
  };
  return new MockLanguageModelV4({
    modelId: "offline-curator",
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(curated) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
      warnings: [],
    }),
  });
}

/** The kit from the research. A reply that doesn't parse gets one more try. */
export async function curate(
  input: Parameters<typeof curatorPrompt>[0],
  abortSignal?: AbortSignal,
  onRetry?: () => void,
): Promise<{ curated: Curated; model: string }> {
  const model = offline() ? offlineCurator(input.items) : MODELS.curator;
  const once = async () =>
    (
      await generateText({
        model,
        output: Output.object({ schema: curatedSchema }),
        prompt: curatorPrompt(input),
        maxOutputTokens: LIMITS.curatorMaxOutputTokens,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.curatorTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output;
  try {
    return { curated: await once(), model: offline() ? "offline" : MODELS.curator };
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || abortSignal?.aborted) throw error;
    onRetry?.();
    return { curated: await once(), model: offline() ? "offline" : MODELS.curator };
  }
}
