import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

const schema = z.object({
  songs: z.array(
    z.object({
      ref: z.string(),
      title: z.string().describe("A well-known recording by that artist, its exact title"),
      year: z.number().int().nullable(),
      artist: z.string().nullable().describe("The artist's full name as credited, e.g. 'Cilla Black' when given 'Cilla'"),
    }),
  ),
});

/**
 * Offline (demo rehearsals, QA, e2e): real, well-known recordings for the fixture artists, so the gallery reads true
 * without the model. Any other artist gets a placeholder that MusicBrainz won't confirm.
 */
const OFFLINE_SONGS: Record<string, { title: string; year: number }> = {
  "The Beatles": { title: "She Loves You", year: 1963 },
  "The Kinks": { title: "Waterloo Sunset", year: 1967 },
  "The Who": { title: "My Generation", year: 1965 },
  "The Zombies": { title: "She's Not There", year: 1964 },
  "Otis Redding": { title: "(Sittin' On) The Dock of the Bay", year: 1968 },
  "The Hollies": { title: "Bus Stop", year: 1966 },
  "Herman's Hermits": { title: "I'm Into Something Good", year: 1964 },
  "Dusty Springfield": { title: "I Only Want to Be With You", year: 1963 },
  "David Bowie": { title: "Starman", year: 1972 },
  "T. Rex": { title: "Get It On", year: 1971 },
  Slade: { title: "Cum On Feel the Noize", year: 1973 },
  "Roxy Music": { title: "Virginia Plain", year: 1972 },
  "Elton John": { title: "Your Song", year: 1970 },
  ABBA: { title: "Waterloo", year: 1974 },
  "The Carpenters": { title: "(They Long to Be) Close to You", year: 1970 },
  "10cc": { title: "I'm Not in Love", year: 1975 },
  "Cilla Black": { title: "Anyone Who Had a Heart", year: 1964 },
  "Elvis Presley": { title: "Heartbreak Hotel", year: 1956 },
  "Buddy Holly": { title: "That'll Be the Day", year: 1957 },
  "Lonnie Donegan": { title: "Rock Island Line", year: 1955 },
  "Cliff Richard": { title: "Living Doll", year: 1959 },
  "Frank Sinatra": { title: "Young at Heart", year: 1953 },
  "Doris Day": { title: "Que Sera, Sera (Whatever Will Be, Will Be)", year: 1956 },
  "Bill Haley & His Comets": { title: "Rock Around the Clock", year: 1954 },
  "Connie Francis": { title: "Who's Sorry Now?", year: 1958 },
  Madonna: { title: "Like a Virgin", year: 1984 },
  "Duran Duran": { title: "Rio", year: 1982 },
  "Whitney Houston": { title: "I Wanna Dance With Somebody (Who Loves Me)", year: 1987 },
  "Wham!": { title: "Wake Me Up Before You Go-Go", year: 1984 },
  "Culture Club": { title: "Karma Chameleon", year: 1983 },
  "Michael Jackson": { title: "Billie Jean", year: 1982 },
  "Kate Bush": { title: "Wuthering Heights", year: 1978 },
  "Dire Straits": { title: "Sultans of Swing", year: 1978 },
  // Spain and India (F7), for the Rosa and Amrit examples.
  Raphael: { title: "Yo soy aquel", year: 1966 },
  Marisol: { title: "Tómbola", year: 1962 },
  "Julio Iglesias": { title: "La vida sigue igual", year: 1968 },
  "Rocío Jurado": { title: "Como una ola", year: 1981 },
  "Mohammed Rafi": { title: "Chaudhvin Ka Chand", year: 1960 },
  "Lata Mangeshkar": { title: "Lag Jaa Gale", year: 1964 },
  "Asha Bhosle": { title: "Aaiye Meherbaan", year: 1958 },
  "Kishore Kumar": { title: "Mere Sapnon Ki Rani", year: 1969 },
  // Japan and Brazil, for the Kazuko and Severino examples.
  "Misora Hibari": { title: "Kanashii Sake", year: 1966 },
  "Kyu Sakamoto": { title: "Ue o Muite Arukō", year: 1961 },
  "Luiz Gonzaga": { title: "Asa Branca", year: 1947 },
  "Roberto Carlos": { title: "Quero Que Vá Tudo pro Inferno", year: 1965 },
  "Elis Regina": { title: "Arrastão", year: 1965 },
};

/** "Cilla" → "Cilla Black": a first name or surname the family used, matched to one known artist. */
function offlineArtist(name: string): string | null {
  if (OFFLINE_SONGS[name]) return name;
  const n = name.toLowerCase().trim();
  const hits = Object.keys(OFFLINE_SONGS).filter((k) => k.toLowerCase().split(/\s+/).includes(n));
  return hits.length === 1 ? hits[0] : null;
}

export type ArtistAsk = { ref: string; artist: string; from: number; to: number; place?: string };

/**
 * One well-known recording per artist, from the years given: Qloo knows artists, not songs. Titles are the model's
 * picks; callers check them on MusicBrainz before anyone sees them. An artist the model isn't sure of is left out.
 */
export async function pickSongs(artists: ArtistAsk[], abortSignal?: AbortSignal): Promise<{ ref: string; title: string; year: number | null; artist: string | null }[]> {
  if (!artists.length) return [];
  const model: LanguageModel = offline()
    ? new MockLanguageModelV4({
        modelId: "offline-songs",
        doGenerate: async () => ({
          // Unknown artists are left out, as the model is told to: a placeholder must never reach the gallery (QA-24).
          content: [{ type: "text", text: JSON.stringify({ songs: artists.flatMap((a) => { const full = offlineArtist(a.artist); return full ? [{ ref: a.ref, artist: full, ...OFFLINE_SONGS[full] }] : []; }) }) }],
          finishReason: { unified: "stop", raw: undefined },
          usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
          warnings: [],
        }),
      })
    : MODELS.curator;
  const prompt = `For each artist, name ONE well-known recording released in (or close to) the years given, the kind people there would have heard most: hits, radio and dance-hall favourites. Give its exact title, its release year, and the artist's full name as credited (the family may use a first name, like "Cilla" or "Dusty"). Never invent a title; if you're not sure of a recording by an artist in those years, leave that artist out.

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
