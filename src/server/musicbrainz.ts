import "server-only";
import { matchRecording, type MbRecording } from "@/lib/song-check";

/**
 * MusicBrainz web service: free for non-commercial use, about 1 request a second per IP, and every request names the
 * app and a contact in its User-Agent. Used only to check that a song title the curator picked is a real recording.
 */
const API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "FrontRoom/0.1 ( https://front-room.vercel.app )";
const GAP_MS = 1100;
const TIMEOUT_MS = 6000;

let nextSlot = 0;
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

const cache = new Map<string, Promise<{ found: boolean; year: number | null }>>();
const quote = (s: string) => `"${s.replace(/["\\]/g, " ")}"`;

/** Whether this artist has a recording with this title, and its first release year. Throws when MusicBrainz can't answer. */
export function checkSong(artist: string, title: string): Promise<{ found: boolean; year: number | null }> {
  const key = `${artist}\u0000${title}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const value = (async () => {
    const query = `recording:${quote(title)} AND artist:${quote(artist)}`;
    let res: Response | null = null;
    // MusicBrainz answers 503 when it's over its rate (seen live, 25 Oct): back off and try twice more.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      await paced();
      res = await fetch(`${API}/recording?query=${encodeURIComponent(query)}&limit=25&fmt=json`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status !== 503) break;
    }
    if (!res?.ok) throw new Error(`MusicBrainz returned ${res?.status}`);
    const json = (await res.json()) as { recordings?: MbRecording[] };
    return matchRecording(json.recordings ?? [], artist, title);
  })();
  cache.set(key, value);
  value.catch(() => cache.delete(key));
  return value;
}
