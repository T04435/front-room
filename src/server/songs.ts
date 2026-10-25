import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

const schema = z.object({
  songs: z.array(z.object({ ref: z.string(), title: z.string().describe("A well-known recording by that artist, its exact title"), year: z.number().int().nullable() })),
});

export type ArtistAsk = { ref: string; artist: string; from: number; to: number; place?: string };

/**
 * One well-known recording per artist, from the years given: Qloo knows artists, not songs. Titles are the model's
 * picks; callers check them on MusicBrainz before anyone sees them. An artist the model isn't sure of is left out.
 */
export async function pickSongs(artists: ArtistAsk[], abortSignal?: AbortSignal): Promise<{ ref: string; title: string; year: number | null }[]> {
  if (!artists.length) return [];
  const model: LanguageModel = offline()
    ? new MockLanguageModelV4({
        modelId: "offline-songs",
        doGenerate: async () => ({
          content: [{ type: "text", text: JSON.stringify({ songs: artists.map((a, i) => ({ ref: a.ref, title: `Test song ${i + 1}`, year: a.from })) }) }],
          finishReason: { unified: "stop", raw: undefined },
          usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
          warnings: [],
        }),
      })
    : MODELS.curator;
  const prompt = `For each artist, name ONE well-known recording released in (or close to) the years given, the kind people there would have heard most: hits, radio and dance-hall favourites. Give its exact title and release year. Never invent a title; if you're not sure of a recording by an artist in those years, leave that artist out.

${artists.map((a) => `${a.ref}: ${a.artist} (${a.from}–${a.to}${a.place ? `, popular around ${a.place}` : ""})`).join("\n")}`;
  const once = async () =>
    (
      await generateText({
        model,
        output: Output.object({ schema }),
        prompt,
        maxOutputTokens: 2000,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.curatorTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output.songs;
  const known = new Set(artists.map((a) => a.ref));
  try {
    return (await once()).filter((s) => known.has(s.ref) && s.title.trim());
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || abortSignal?.aborted) throw error;
    return (await once()).filter((s) => known.has(s.ref) && s.title.trim());
  }
}
