import "server-only";
import { eraFor, pickDecadeTag } from "@/lib/era";
import { itemKey, type ItemStat } from "@/lib/learning";
import { birthYearOf, eraForPlace, steersClear, type Person, type Suggestion } from "@/lib/person";
import { nameKey, parseInsights, parseSearch, parseTags, pickByName } from "@/lib/qloo-parse";
import type { CallLog } from "@/lib/qloo-transport";
import { offline } from "@/server/env";
import { checkSong } from "@/server/musicbrainz";
import { QlooError, qlooGet } from "@/server/qloo";
import { pickSongs } from "@/server/songs";

export const NEW_TRIES_KEY = "new-tries";
const COUNT = 3;

/** What new tries are seeded from: the proven songs (best first), else the family's loved artists and songs. */
export function seedsOf(p: Person, stats: Map<string, ItemStat>): { name: string; like: string }[] {
  const proven = [...stats.values()].filter((s) => s.state === "proven" && s.type === "song" && s.by).sort((a, b) => b.sangSessions + b.engagedSessions - (a.sangSessions + a.engagedSessions));
  if (proven.length) return proven.slice(0, 2).map((s) => ({ name: s.by!, like: s.title }));
  return p.loves.filter((l) => l.type === "artist" || (l.type === "song" && l.by)).slice(0, 2).map((l) => ({ name: l.by ?? l.title, like: l.title }));
}

/** Whether the new tries are out of date: what works changed since they were found. */
export const newTriesStale = (p: Person, stats: Map<string, ItemStat>) => {
  const seeds = seedsOf(p, stats);
  return seeds.length > 0 && p.researched[NEW_TRIES_KEY] !== JSON.stringify(seeds);
};

/**
 * New tries: Qloo's artists liked by people who like what works for them, in their place and decade, as songs checked
 * on MusicBrainz. "New try · like Waterloo". Replaces the old ones, keeping any the family already answered.
 */
export async function findNewTries(p: Person, stats: Map<string, ItemStat>, onCall: (log: CallLog) => void, abortSignal?: AbortSignal): Promise<Person> {
  const seeds = seedsOf(p, stats);
  const by = birthYearOf(p);
  const home = p.places[0];
  if (!seeds.length || by === null || !home) return p;
  const range = eraForPlace(home, by);
  const era = eraFor(by, [range.from, range.to]);
  const lead = era.decades[0];
  const known = new Set([...Object.values(p.suggestions).flat().map((s) => nameKey(s.by ?? s.title)), ...p.loves.map((l) => nameKey(l.by ?? l.title)), ...[...stats.values()].map((s) => nameKey(s.by ?? s.title))]);
  let tag: string | undefined;
  try {
    tag = pickDecadeTag(parseTags((await qlooGet("/v2/tags", { "filter.query": lead.short, "filter.tag.types": "urn:tag:genre:music", take: 15 }, onCall)).data), lead.start)?.id;
  } catch (e) {
    if (!(e instanceof QlooError)) throw e;
  }
  const artists: { name: string; like: string }[] = [];
  for (const seed of seeds) {
    try {
      const match = pickByName(parseSearch((await qlooGet("/search", { query: seed.name, types: "urn:entity:artist", take: 5 }, onCall)).data), seed.name);
      if (!match) continue;
      const r = await qlooGet("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": match.id, "filter.tags": tag, "signal.location.query": home.name, take: 8 }, onCall);
      for (const e of parseInsights(r.data)) {
        if (known.has(nameKey(e.name)) || steersClear(p, e.name) || artists.some((a) => nameKey(a.name) === nameKey(e.name))) continue;
        artists.push({ name: e.name, like: seed.like });
        if (artists.length >= COUNT + 2) break;
      }
    } catch (e) {
      if (!(e instanceof QlooError)) throw e;
    }
  }
  const picks = await pickSongs(artists.map((a, i) => ({ ref: `t${i}`, artist: a.name, from: era.from, to: era.to, place: home.name })), abortSignal);
  const old = new Map((p.suggestions[NEW_TRIES_KEY] ?? []).filter((s) => s.answer).map((s) => [itemKey({ type: s.type, title: s.title, by: s.by }), s]));
  const fresh: Suggestion[] = [...old.values()];
  for (const pick of picks) {
    if (fresh.length >= COUNT + old.size) break;
    const a = artists[Number(pick.ref.slice(1))];
    if (!offline() && !(await checkSong(a.name, pick.title).then((r) => r.found).catch(() => false))) continue;
    fresh.push({
      id: `nt-${nameKey(a.name).replace(/\s+/g, "-").slice(0, 20)}-${Date.now().toString(36)}`,
      placeId: home.id,
      type: "song",
      title: pick.title,
      by: a.name,
      year: pick.year,
      like: a.like,
      parts: [lead.short, `like ${a.like}`, home.name, "Qloo", ...(offline() ? [] : ["MusicBrainz"])],
      source: `New try: Qloo, liked by people who like ${a.like}, ${lead.short}, ${home.name}.`,
    });
  }
  return { ...p, suggestions: { ...p.suggestions, [NEW_TRIES_KEY]: fresh }, researched: { ...p.researched, [NEW_TRIES_KEY]: JSON.stringify(seeds) } };
}
