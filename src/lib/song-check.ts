import { nameKey } from "./qloo-parse";

/** A MusicBrainz recording search result, the fields the check reads. */
export type MbRecording = {
  title?: string;
  score?: number;
  "first-release-date"?: string;
  "artist-credit"?: { name?: string; artist?: { name?: string } }[];
};

/** A title without its edition notes: "Hey Jude (Remastered 2015)" → "hey jude", "Waterloo - Single Version" → "waterloo". */
export function baseTitle(title: string): string {
  return nameKey(title.replace(/\s*[([].*?[)\]]\s*/g, " ").replace(/\s+-\s+.*$/, ""));
}

/**
 * Whether MusicBrainz has this song by this artist: a recording with the same base title, credited to the artist (or
 * an artist credit containing it, for "Dusty Springfield & …"). The year is the earliest first release among matches.
 */
export function matchRecording(results: MbRecording[], artist: string, title: string): { found: boolean; year: number | null } {
  const want = baseTitle(title);
  const who = nameKey(artist);
  const years = results
    .filter((r) => r.title && baseTitle(r.title) === want)
    .filter((r) => (r["artist-credit"] ?? []).some((c) => [c.name, c.artist?.name].some((n) => n && (nameKey(n) === who || ` ${nameKey(n)} `.includes(` ${who} `)))))
    .map((r) => Number(r["first-release-date"]?.slice(0, 4)));
  if (!years.length) return { found: false, year: null };
  const known = years.filter((y) => Number.isFinite(y) && y > 1800);
  return { found: true, year: known.length ? Math.min(...known) : null };
}
