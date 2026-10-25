import type { AskField, Kit, KitItem } from "./kit";

/** One line of the NDJSON stream from POST /api/run. Only what the page shows: Qloo's raw responses never leave the server. */
export type RunEvent =
  | { type: "note"; text: string }
  | { type: "step-start"; id: string; tool: string; label: string }
  /** `via`: how the step's calls went ("notonq", "qloo", or "mixed"); `fellBack`: NotOnQ failed and Qloo answered. */
  | { type: "step-end"; id: string; ok: boolean; summary: string; items: KitItem[]; via?: "notonq" | "qloo" | "mixed"; fellBack?: boolean }
  /** The run stopped: it needs an answer. The page asks inline, then sends the brief again with the answers. */
  | { type: "ask"; fields: AskField[]; message: string }
  | { type: "curating"; itemCount: number }
  | { type: "kit"; kit: Kit }
  /** `budget`: a daily budget or a rate limit was hit; the page points to the saved kits, which always open. */
  | { type: "error"; message: string; budget?: boolean }
  | { type: "done"; qlooCalls: number; qlooCached: number; seconds: number };

export const TOOL_LABELS: Record<string, string> = {
  find_place: "Find where they grew up",
  era_tags: "Work out the music of their teens and twenties",
  era_artists: "Artists of the era, popular around their hometown",
  likes: "Start from what the family knows",
  era_films: "Films of those years",
  era_tv: "TV of those years",
  era_places: "Places from their hometown that are still there",
  music_words: "Turn the family's words into music",
  curate: "Build the session kit",
};
