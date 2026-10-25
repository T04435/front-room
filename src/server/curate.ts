import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describeEra, type Era } from "@/lib/era";
import { curatedSchema, type Curated, type Item } from "@/lib/kit";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

const KIND_LABEL: Record<Item["kind"], string> = { artist: "artist", film: "film", tv: "TV", family: "from the family" };

export const CURATOR_RULES = `You build a 20-minute music session kit that care staff will use with an older person, from research on the music, films and TV of the years they were 15 to 25, where they grew up.

Playlist:
- 7 or 8 tracks. Each cites one artist ref from the research (an "artist" item), at most one track per artist.
- Name ONE well-known recording by that artist, released in or close to the era years given, by its exact title. Prefer the songs people of that time and place would have heard most (the hits, the dance-hall and radio favourites). Never invent a title; if you're not sure of a recording by an artist, leave that artist out.
- Order: "calm" first (gentle, slower, 2–3 tracks), then "familiar" (the best-known, 2–3 tracks), then "singalong" (big choruses everyone knows, 2–3 tracks).
- "why" is one short line for staff, about the song in that place and time.

Conversation prompts:
- 5 or 6 prompts staff can say out loud. Each cites the refs of the items it mentions (an artist, a film, a TV show, the place, something from the family).
- Gentle and open: invite a story or an opinion ("This was on at every picture house in 1965. Who would you go to the pictures with?"). Never test memory: no "Do you remember…?", no quiz questions, no correcting.
- Mention the hometown where it helps.

Rules:
- Use only refs from the research list. Items marked "from the family" are things the family told us: weave them in.
- This is about engagement and enjoyment, never treatment: no medical or therapeutic claims.
- Plain British English for a UK place, plain American English for a US place, otherwise plain international English.`;

function researchList(items: Item[]): string {
  return items.map((i) => `${i.ref} [${KIND_LABEL[i.kind]}] ${i.name}${i.year ? ` (${i.year})` : ""}: ${i.source}`).join("\n");
}

export function curatorPrompt(input: { place: string; era: Era; name?: string; items: Item[]; avoid?: string[] }): string {
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
function offlineCurator(items: Item[]): LanguageModel {
  const artists = items.filter((i) => i.kind === "artist").slice(0, 7);
  const others = items.filter((i) => i.kind !== "artist");
  const phases = ["calm", "calm", "familiar", "familiar", "familiar", "singalong", "singalong"] as const;
  const curated: Curated = {
    playlist: artists.map((a, n) => ({ ref: a.ref, song: `Test song ${n + 1}`, year: a.year, phase: phases[n] ?? "singalong", why: `Offline fixture for ${a.name}.` })),
    prompts: [...others.slice(0, 3), ...artists.slice(0, 2)].map((i) => ({ text: `Tell me about ${i.name}. What did you think of it?`, refs: [i.ref] })),
    summary: "Offline fixture kit: gentle start, the big names in the middle, singalongs to finish.",
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
