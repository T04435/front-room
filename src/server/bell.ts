import "server-only";
import { describeEra, eraFor, pickDecadeTag } from "@/lib/era";
import { birthYearOf, eraForPlace, researchInputs, researchKey, steersClear, type Person, type Place, type Suggestion } from "@/lib/person";
import { nameKey, parseInsights, parseSearch, parseTags, pickByName } from "@/lib/qloo-parse";
import type { CallLog, QlooParams } from "@/lib/qloo-transport";
import type { RunEvent } from "@/lib/run-events";
import { offline } from "@/server/env";
import { checkSong } from "@/server/musicbrainz";
import { QlooError, qlooGet } from "@/server/qloo";
import { pickSongs } from "@/server/songs";

type Emit = (event: RunEvent) => void;
type OnCall = (log: CallLog) => void;

/** About 10 cards per place: songs, a couple of films, the telly, places, and things like what they love. */
const PER_PLACE = { artists: 6, films: 2, tv: 2, places: 2, likes: 3 };
/** Places researched per Go for it (a long story is researched over several). */
const MAX_PLACES = 4;

const get = (path: string, params: QlooParams, onCall: OnCall) => qlooGet<unknown>(path, params, onCall);

/** The places whose research is missing or out of date (their place, years, loves or steer-clears changed). */
export function placesToResearch(p: Person): Place[] {
  const by = birthYearOf(p);
  if (by === null) return [];
  return p.places.filter((pl) => p.researched[researchKey(pl, by)] !== researchInputs(p, pl)).slice(0, MAX_PLACES);
}

/** `eraFrom`/`eraTo`: the place's era, so a song picked for an artist comes from those years. */
type Draft = Omit<Suggestion, "id"> & { artist?: string; eraFrom?: number; eraTo?: number };

/**
 * Qloo research after Go for it (never during the chat), per place and era: artists from decade tags plus the place,
 * films and TV from release years plus the place, historic places, and things like each love. Qloo gets years, places
 * and taste entities only: never names or steer-clear topics. Everything passes the steer-clear list. Artists become
 * songs (the model's picks, checked on MusicBrainz). Returns the person with the new cards, ready to save.
 */
export async function researchPerson(p: Person, emit: Emit, onCall: OnCall, abortSignal?: AbortSignal): Promise<Person> {
  const by = birthYearOf(p)!;
  const places = placesToResearch(p);
  const drafts = new Map<string, Draft[]>();
  for (const place of places) {
    const range = eraForPlace(place, by);
    const era = eraFor(by, [range.from, range.to]);
    const years = describeEra(era);
    const id = `place-${place.id}`;
    emit({ type: "step-start", id, tool: "research_place", title: `${place.name}, ${years}`, running: `Looking up songs, films, TV and places for ${place.name} in ${years}` });
    const found: Draft[] = [];
    const sources = new Set<string>();
    const call: OnCall = (log) => {
      onCall(log);
      if (log.status === 200) sources.add(log.servedBy === "notonq" ? "NotOnQ" : "Qloo");
    };
    try {
      found.push(...(await researchPlace(p, place, era, call)));
      emit({
        type: "step-end",
        id,
        ok: found.length > 0,
        summary: found.length ? `Found ${found.length} things ${p.preferredName || "they"} may know from ${place.name} in ${years}.` : `Qloo had nothing for ${place.name} in ${years}.`,
        items: [],
        chips: found.slice(0, 8).map((d) => d.artist ?? d.title),
        sources: sources.size ? [...sources] : ["Qloo"],
        sourceLine: `${era.decades.map((d) => d.short).join(" and ")} · ${place.name} · Qloo`,
      });
    } catch (error) {
      if (!(error instanceof QlooError)) throw error;
      console.error("bell research failed", place.name, error.message);
      emit({ type: "step-end", id, ok: false, summary: `Qloo didn't answer in time for ${place.name}. Try again in a minute.`, items: [], chips: [], sources: ["Qloo"] });
    }
    drafts.set(researchKey(place, by), found);
  }

  // Artists into songs: one call for every place, then MusicBrainz confirms each title.
  const artists = [...drafts.values()].flat().filter((d) => d.type === "artist");
  if (artists.length) {
    emit({ type: "step-start", id: "songs", tool: "check_songs", title: "Songs for those artists", running: "Picking a song each, then checking the titles on MusicBrainz" });
    const asks = artists.map((d, i) => ({ ref: `a${i}`, artist: d.title, from: d.eraFrom ?? d.year ?? by + 10, to: d.eraTo ?? (d.year ?? by + 10) + 10, place: d.parts[1] }));
    const picks = await pickSongs(asks, abortSignal).catch((e) => {
      console.error("song picks failed", e instanceof Error ? e.message : e);
      return [];
    });
    let confirmed = 0;
    for (const pick of picks) {
      const d = artists[Number(pick.ref.slice(1))];
      const ok = offline() ? true : await checkSong(d.title, pick.title).then((r) => r.found).catch(() => false);
      if (!ok) continue;
      confirmed++;
      // A recording from outside the place's era (by more than a year) isn't kept: the era is the point.
      if (pick.year && d.eraFrom && d.eraTo && (pick.year < d.eraFrom - 1 || pick.year > d.eraTo + 1)) continue;
      Object.assign(d, { type: "song", artist: d.title, by: d.title, title: pick.title, year: pick.year ?? d.year, parts: [...d.parts, ...(offline() ? [] : ["MusicBrainz"])] });
    }
    emit({
      type: "step-end",
      id: "songs",
      ok: confirmed > 0,
      summary: `${confirmed} songs, each a real recording by its artist. Artists without a checked song are left out.`,
      items: [],
      chips: [],
      sources: offline() ? [] : ["MusicBrainz"],
      sourceLine: "song titles · MusicBrainz",
    });
  }

  const suggestions = { ...p.suggestions };
  const researched = { ...p.researched };
  for (const place of places) {
    const key = researchKey(place, by);
    const old = new Map((suggestions[key] ?? []).map((s) => [nameKey(s.title), s]));
    const fresh = (drafts.get(key) ?? []).filter((d) => d.type !== "artist" && !steersClear(p, d.title, d.by));
    // Answers already given stay with their card.
    suggestions[key] = fresh.map((d, i) => {
      const before = old.get(nameKey(d.title));
      const { artist, ...card } = d;
      void artist;
      return { ...card, id: before?.id ?? `${place.id}-${i}-${nameKey(d.title).replace(/\s+/g, "-").slice(0, 24)}`, ...(before?.answer ? { answer: before.answer } : {}) };
    });
    researched[key] = researchInputs(p, place);
  }
  return { ...p, suggestions, researched };
}

async function researchPlace(p: Person, place: Place, era: ReturnType<typeof eraFor>, onCall: OnCall): Promise<Draft[]> {
  const where = place.name;
  const years = describeEra(era);
  const out: Draft[] = [];
  const seen = new Set<string>();
  const add = (d: Draft) => {
    const k = `${d.type}:${nameKey(d.title)}`;
    if (seen.has(k) || steersClear(p, d.title)) return;
    seen.add(k);
    out.push(d);
  };

  // Artists: the era's decade tags, popular around the place.
  const tags: { short: string; id: string; years: number }[] = [];
  // A decade the era barely touches (a single year) would bring that decade's sound, not theirs.
  for (const d of era.decades.filter((x) => x.years >= 2 || era.decades.length === 1)) {
    const { data } = await get("/v2/tags", { "filter.query": d.short, "filter.tag.types": "urn:tag:genre:music", take: 15 }, onCall);
    const tag = pickDecadeTag(parseTags(data), d.start);
    if (tag) tags.push({ short: d.short, id: tag.id, years: d.years });
  }
  for (const t of tags) {
    const r = await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.tags": t.id, "signal.location.query": where, take: 10 }, onCall);
    const share = Math.max(2, Math.round((PER_PLACE.artists * t.years) / Math.max(1, era.to - era.from + 1)));
    for (const e of parseInsights(r.data).slice(0, share)) {
      add({ placeId: place.id, type: "artist", title: e.name, year: decadeStart(t.short), eraFrom: era.from, eraTo: era.to, parts: [t.short, where, r.servedBy === "notonq" ? "via NotOnQ" : "Qloo"], source: `Qloo: artists popular around ${where} in the ${t.short}.`, qlooId: e.id });
    }
  }

  // Things like what they love, in that decade and place: a film seeds music, a dance hall its era's songs.
  const lead = tags.sort((a, b) => b.years - a.years)[0];
  for (const love of p.loves.filter((l) => l.source !== "ring_a_bell").slice(0, PER_PLACE.likes)) {
    const types = love.type === "film" ? "urn:entity:movie" : love.type === "tv" ? "urn:entity:tv_show" : "urn:entity:artist";
    const s = await get("/search", { query: love.by && love.type === "song" ? love.by : love.title, types, take: 5 }, onCall);
    const match = pickByName(parseSearch(s.data), love.by && love.type === "song" ? love.by : love.title);
    if (!match) continue;
    const r = await get("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": match.id, "filter.tags": lead?.id, "signal.location.query": where, take: 4 }, onCall);
    for (const e of parseInsights(r.data).slice(0, 2)) {
      if (nameKey(e.name) === nameKey(match.name)) continue;
      add({ placeId: place.id, type: "artist", title: e.name, year: lead ? decadeStart(lead.short) : null, eraFrom: era.from, eraTo: era.to, parts: [lead?.short ?? years, `like ${match.name}`, "Qloo"], source: `Qloo: liked by people who like ${match.name}${lead ? `, ${lead.short}` : ""}, around ${where}.`, qlooId: e.id });
    }
  }

  // Books like the ones the family mentioned (Qloo's book years are editions, so books come from their own loves).
  for (const love of p.loves.filter((l) => l.type === "book").slice(0, 2)) {
    const s = await get("/search", { query: love.title, types: "urn:entity:book", take: 5 }, onCall);
    const match = pickByName(parseSearch(s.data), love.title);
    if (!match) continue;
    const r = await get("/v2/insights", { "filter.type": "urn:entity:book", "signal.interests.entities": match.id, take: 5 }, onCall);
    for (const e of parseInsights(r.data).slice(0, 3)) {
      if (nameKey(e.name) !== nameKey(match.name)) add({ placeId: place.id, type: "book", title: e.name, year: e.year, parts: ["book", `like ${match.name}`, "Qloo"], source: `Qloo: liked by readers of ${match.name}.`, qlooId: e.id });
    }
  }

  // Films and TV from the era's release years, popular around the place.
  for (const [kind, type, n] of [["film", "urn:entity:movie", PER_PLACE.films], ["tv", "urn:entity:tv_show", PER_PLACE.tv]] as const) {
    const base = { "filter.type": type, "filter.release_year.min": era.from, "filter.release_year.max": era.to, take: 8 };
    const r = await get("/v2/insights", { ...base, "signal.location.query": where }, onCall);
    let found = parseInsights(r.data);
    // TV is thin by place (two shows for London in the probes): fall back to the era's TV anywhere.
    if (found.length < n) found = [...found, ...parseInsights((await get("/v2/insights", base, onCall)).data)];
    for (const e of found.slice(0, n + 2).filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i).slice(0, n)) add({ placeId: place.id, type: kind, title: e.name, year: e.year, parts: [kind === "film" ? "film" : "TV", e.year ? String(e.year) : years, "Qloo"], source: `Qloo: ${kind === "film" ? "films" : "TV"} from ${years}, popular around ${where}.`, qlooId: e.id });
  }

  // Long-standing places in the town (Qloo's are today's; these were likely there then too).
  const r = await get("/v2/insights", { "filter.type": "urn:entity:place", "filter.location.query": where, "filter.tags": "urn:tag:ambience:qloo:historic", take: 6 }, onCall);
  for (const e of parseInsights(r.data).slice(0, PER_PLACE.places)) add({ placeId: place.id, type: "place", title: e.name, year: null, parts: ["place", where, "Qloo"], source: `Qloo: a long-standing place in ${where}, still there today.`, qlooId: e.id });

  return out;
}

/** "60s" → 1960, "2000s" → 2000. */
function decadeStart(short: string): number {
  const n = Number(short.replace(/\D/g, ""));
  return n >= 1000 ? n : 1900 + n;
}

