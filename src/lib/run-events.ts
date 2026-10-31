import type { AskField, Kit, KitItem } from "./kit";

/** One line of the NDJSON stream from POST /api/run. Only what the page shows: Qloo's raw responses never leave the server. */
export type RunEvent =
  | { type: "note"; text: string }
  /** `title`: the step in plain words ("Songs Margaret may know"); `running`: the line while it works ("Finding songs from Manchester in the 60s"). */
  | { type: "step-start"; id: string; tool: string; title: string; running: string }
  /**
   * `summary`: the Go-Between's note once it's done. `chips`: the names it found. `sources`: which sources answered
   * (Qloo, NotOnQ, MusicBrainz), for the step's SourceTag. `sourceLine`: era · place · source, in the `source` style.
   * `fellBack`: NotOnQ didn't answer and Qloo did, directly.
   */
  | { type: "step-end"; id: string; ok: boolean; summary: string; items: KitItem[]; chips: string[]; sources: string[]; sourceLine?: string; fellBack?: boolean }
  /** The run stopped: it needs an answer. The page asks inline, then sends the brief again with the answers. */
  | { type: "ask"; fields: AskField[]; message: string }
  | { type: "kit"; kit: Kit }
  /** `budget`: a daily budget or a rate limit was hit; the page shows the budget-spent state and points to saved kits. */
  | { type: "error"; message: string; budget?: boolean }
  | { type: "done"; qlooCalls: number; qlooCached: number; seconds: number }
  /** A person's films, TV and places are saved; their songs are still being checked. */
  | { type: "ready" };

/** "Margaret’s" or "Their", for step titles and status lines; `lower` for mid-sentence. */
export function possessive(name: string | undefined, lower = false): string {
  if (!name) return lower ? "their" : "Their";
  return `${name}${name.endsWith("s") ? "’" : "’s"}`;
}
