import "server-only";
import { nameKey, parseSearch, pickByName } from "@/lib/qloo-parse";
import type { Person, Suggestion } from "@/lib/person";
import { QlooError, qlooGet } from "@/server/qloo";

export const PICTURES_KEY = "pictures";
const MAX_LOOKUPS = 24;
const TYPES: Record<Suggestion["type"], string> = { song: "urn:entity:artist", artist: "urn:entity:artist", film: "urn:entity:movie", tv: "urn:entity:tv_show", book: "urn:entity:book", place: "urn:entity:place" };

/** Cards with no picture yet (people looked up before pictures were kept). */
export const missingPictures = (p: Person) => Object.values(p.suggestions).flat().filter((s) => !s.image);

/** Whether to try: some cards lack a picture, and we haven't tried for this person yet. */
export const picturesDue = (p: Person) => !p.example && !p.researched[PICTURES_KEY] && missingPictures(p).length > 0;

/**
 * Finds Qloo's picture for cards that have none: an artist's photo for a song, else the title's own. One search per
 * name (at most 24), only the URL kept. Marks the person so it's tried once.
 */
export async function addPictures(p: Person, onCall?: Parameters<typeof qlooGet>[2]): Promise<Person> {
  const found = new Map<string, string | null>();
  const lookups = new Map<string, { query: string; type: string }>();
  for (const s of missingPictures(p)) {
    const query = s.type === "song" ? (s.by ?? s.title) : s.title;
    const k = `${TYPES[s.type]}|${nameKey(query)}`;
    if (!lookups.has(k) && lookups.size < MAX_LOOKUPS) lookups.set(k, { query, type: TYPES[s.type] });
  }
  // Six at a time: a gallery shouldn't wait on 24 searches in a row.
  const all = [...lookups];
  for (let i = 0; i < all.length; i += 6) {
    await Promise.all(
      all.slice(i, i + 6).map(async ([k, { query, type }]) => {
        try {
          const r = await qlooGet<unknown>("/search", { query, types: type, take: 3 }, onCall);
          const hits = parseSearch(r.data);
          found.set(k, (pickByName(hits, query) ?? hits[0])?.image ?? null);
        } catch (e) {
          if (!(e instanceof QlooError)) throw e;
        }
      }),
    );
  }
  const suggestions = Object.fromEntries(
    Object.entries(p.suggestions).map(([key, cards]) => [
      key,
      cards.map((s) => {
        if (s.image) return s;
        const image = found.get(`${TYPES[s.type]}|${nameKey(s.type === "song" ? (s.by ?? s.title) : s.title)}`);
        return image ? { ...s, image } : s;
      }),
    ]),
  );
  return { ...p, suggestions, researched: { ...p.researched, [PICTURES_KEY]: new Date().toISOString() } };
}
