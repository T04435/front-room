import { z } from "zod";
import { MAX_BIRTH_YEAR, MIN_BIRTH_YEAR, type Era } from "./era";
import type { Via } from "./qloo-transport";

// ---- The brief: what a carer or family member enters --------------------------------------------------------------

export const briefSchema = z.object({
  /** A first name or nickname for the kit's title; optional, never sent to Qloo. */
  name: z.string().trim().max(40).optional(),
  birthYear: z.number().int().min(MIN_BIRTH_YEAR).max(MAX_BIRTH_YEAR),
  /** Where they grew up: a town or city, as typed. */
  place: z.string().trim().min(2).max(80),
  /** Things the family already knows they loved: artists, films, a dance hall. */
  likes: z.array(z.string().trim().min(2).max(80)).max(5).optional(),
  /** Answers to the run's inline question, sent back with the same brief. */
  answers: z
    .object({
      /** A bigger town nearby, when Qloo doesn't know the place. */
      nearbyPlace: z.string().trim().min(2).max(80).optional(),
      /** A kind of music they loved, when the era comes back thin. */
      musicWords: z.string().trim().min(2).max(120).optional(),
    })
    .optional(),
  /** Items the family marked "not for them" on an earlier run. */
  avoid: z.array(z.string().max(120)).max(30).optional(),
});
export type Brief = z.infer<typeof briefSchema>;
export type AskField = "nearbyPlace" | "musicWords";

// ---- The research: what Qloo found, with where it came from -------------------------------------------------------

/** `family`: something the family told us (a like Qloo doesn't know as an artist), cited as itself. */
export type ItemKind = "artist" | "film" | "tv" | "family";

/** One thing the research found. `ref` (A1, F2, T3, K1) is how the playlist and prompts cite it. */
export type Item = {
  ref: string;
  kind: ItemKind;
  name: string;
  year: number | null;
  /** Qloo's entity id, kept to link back; never shown. */
  entityId: string;
  /** Where it came from, in words: "Qloo: 60s music, popular around Manchester". */
  source: string;
  /** Which way the call went: NotOnQ's drop-in API, or Qloo directly (always so when NotOnQ failed). */
  via: Via;
};

// ---- The kit: what the curator writes, checked against the research -----------------------------------------------

export const PHASES = ["calm", "familiar", "singalong"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = { calm: "Settle in", familiar: "Familiar", singalong: "Sing along" };

export const curatedSchema = z.object({
  playlist: z
    .array(
      z.object({
        ref: z.string().describe("The artist's ref from the research list, e.g. A3"),
        song: z.string().describe("A well-known recording by that artist from the era years, its exact title"),
        year: z.number().int().nullable().describe("The recording's release year if known"),
        phase: z.enum(PHASES),
        why: z.string().describe("One short line for staff: why this one, at this point"),
      }),
    )
    .describe("7 or 8 tracks, about 20 minutes, in playing order: calm first, then familiar, then singalong"),
  prompts: z
    .array(
      z.object({
        text: z.string().describe("A gentle, open conversation prompt staff can say out loud"),
        refs: z.array(z.string()).describe("Refs of the items it mentions (1–3)"),
      }),
    )
    .describe("5 or 6 prompts"),
  summary: z.string().describe("One sentence for staff on the kit's shape"),
});
export type Curated = z.infer<typeof curatedSchema>;

export type Track = Curated["playlist"][number] & { artist: string; minutes: number; links: { spotify: string; youtube: string } };
export type Prompt = Curated["prompts"][number];

export type Kit = {
  id: string;
  brief: Pick<Brief, "name" | "birthYear" | "place" | "likes">;
  place: string;
  era: Era;
  items: Item[];
  playlist: Track[];
  prompts: Prompt[];
  summary: string;
  /** How many of the research calls went through NotOnQ, and how many fell back to Qloo directly. */
  sources: { notonq: number; qloo: number; fellBack: number };
  model: string;
  createdAt: string;
};

export const RESPONSES = ["calm", "engaged", "sang", "upset"] as const;
export type Response = (typeof RESPONSES)[number];
export const RESPONSE_LABELS: Record<Response, string> = { calm: "Calm", engaged: "Engaged", sang: "Sang along", upset: "Upset" };
export type LogEntry = { id: number; response: Response; trackRef: string | null; at: string };

/** About 3 minutes a track (singles of the era ran short): 7 tracks make about 20 minutes. */
export const TRACK_MINUTES = 3;

export function searchLinks(artist: string, song: string) {
  const q = encodeURIComponent(`${artist} ${song}`);
  return { spotify: `https://open.spotify.com/search/${q}`, youtube: `https://www.youtube.com/results?search_query=${q}` };
}

export type Problem = { where: string; message: string };

/**
 * The curator's kit, checked against the research: tracks must cite a known artist, prompts known items. A bad
 * citation drops that track or prompt (and is reported), so nothing on the page points at a source that doesn't exist.
 * Tracks are put in phase order, keeping the curator's order within a phase; one track per artist.
 */
export function checkCurated(curated: Curated, items: Item[]): { playlist: Track[]; prompts: Prompt[]; problems: Problem[] } {
  const byRef = new Map(items.map((i) => [i.ref, i]));
  const problems: Problem[] = [];
  const used = new Set<string>();
  const tracks: Track[] = [];
  curated.playlist.forEach((t, n) => {
    const item = byRef.get(t.ref);
    if (!item || item.kind !== "artist") return problems.push({ where: `track ${n + 1}`, message: `cites ${t.ref}, which isn't an artist in the research` });
    if (used.has(t.ref)) return problems.push({ where: `track ${n + 1}`, message: `${item.name} is already on the playlist` });
    if (!t.song.trim()) return problems.push({ where: `track ${n + 1}`, message: "has no song" });
    used.add(t.ref);
    tracks.push({ ...t, song: t.song.trim(), artist: item.name, minutes: TRACK_MINUTES, links: searchLinks(item.name, t.song.trim()) });
  });
  const playlist = PHASES.flatMap((p) => tracks.filter((t) => t.phase === p));
  const prompts = curated.prompts.flatMap((p, n) => {
    const refs = [...new Set(p.refs)];
    const unknown = refs.filter((r) => !byRef.has(r));
    if (unknown.length || !p.text.trim()) {
      problems.push({ where: `prompt ${n + 1}`, message: unknown.length ? `cites ${unknown.join(", ")}, not in the research` : "is empty" });
      return [];
    }
    return [{ text: p.text.trim(), refs }];
  });
  return { playlist, prompts, problems };
}

export function playlistMinutes(playlist: Track[]): number {
  return playlist.reduce((sum, t) => sum + t.minutes, 0);
}

export function kitTitle(kit: Pick<Kit, "brief" | "place" | "era">): string {
  const who = kit.brief.name ? `${kit.brief.name}'s` : "A";
  return `${who} session kit · ${kit.place}, ${kit.era.from}–${kit.era.to}`;
}
