import "server-only";
import { describeEra, eraFor, pickDecadeTag } from "@/lib/era";
import { harshKeywords, isInstitution, isMemorial, pickVenue } from "@/lib/card-words";
import { STAND_INS_KEY } from "@/lib/gallery";
import { birthYearOf, eraForPlace, researchInputs, researchKey, steersClear, talkingPoints, type Person, type Place, type Suggestion } from "@/lib/person";
import { nameKey, parseInsights, parseSearch, parseTags, pickByName, type QlooEntity } from "@/lib/qloo-parse";
import type { CallLog, CallOptions, QlooParams } from "@/lib/qloo-transport";
import type { RunEvent } from "@/lib/run-events";
import { offline } from "@/server/env";
import { countryName, globalIsLocal, kmBetween, type Locality, localTags, loveOrigin, type Origin, resolvePlaces, SAME_TOWN_KM } from "@/server/locality";
import { checkSong } from "@/server/musicbrainz";
import { NO_HORROR, QlooError, qlooGet } from "@/server/qloo";
import { pickSongs } from "@/server/songs";

type Emit = (event: RunEvent) => void;
type OnCall = (log: CallLog) => void;

/** About 10 cards per place: songs, a couple of films, the telly, places, and things like what they love. */
const PER_PLACE = { artists: 6, films: 2, tv: 2, places: 2, likes: 3 };
/** NotOnQ's budget for an artist call with a music tag: its era fill takes 4–14 s cold. */
export const MUSIC_NOTONQ_MS = 20_000;

/** A call's budgets: an artist call with a music tag gets at least MUSIC_NOTONQ_MS for NotOnQ, and the cold-fill retry. */
export function musicCallOptions(params: QlooParams, opts: CallOptions = {}): CallOptions {
  const tagged = params["filter.type"] === "urn:entity:artist" && String(params["filter.tags"] ?? "").includes("urn:tag:genre:music:");
  return tagged ? { ...opts, notonqTimeoutMs: Math.max(opts.notonqTimeoutMs ?? 0, MUSIC_NOTONQ_MS), retryFill: true } : opts;
}
/** Suggestions for the artists the family named (not tied to a place). */
export const FAMILY_KEY = "family";
/** Places researched per Go for it (a long story is researched over several). */
const MAX_PLACES = 4;

const get = (path: string, params: QlooParams, onCall: OnCall, opts?: CallOptions) => qlooGet<unknown>(path, params, onCall, opts);

/** The places whose research is missing or out of date (their place, years, loves or steer-clears changed). */
export function placesToResearch(p: Person): Place[] {
  const by = birthYearOf(p);
  if (by === null) return [];
  // A place they left as a small child (before about 8) has no years of theirs to look up: born in Lahore, grew up in
  // Amritsar after 1947.
  const remembered = (pl: Place) => pl.toYear === null || pl.toYear >= by + 8;
  return p.places.filter((pl) => remembered(pl) && p.researched[researchKey(pl, by)] !== researchInputs(p, pl)).slice(0, MAX_PLACES);
}

/** `eraFrom`/`eraTo`: the place's era, so a song picked for an artist comes from those years. */
type Draft = Omit<Suggestion, "id"> & { artist?: string; eraFrom?: number; eraTo?: number };

/** One town to look up: a place (or places in the same town: Govan in Glasgow) and its locality. */
type Town = { place: Place; also: Place[]; where: Locality | null; era: ReturnType<typeof eraFor> };

/**
 * Places in the same town become one look-up (Govan is in Glasgow: A4). The town's era comes from the places that have
 * years, so a "grew up in Govan" with none doesn't stretch Glasgow's.
 */
function townsOf(places: Place[], where: Map<string, Locality | null>, by: number): Town[] {
  const towns: Town[] = [];
  for (const place of places) {
    const loc = where.get(place.id) ?? null;
    const same = towns.find((t) => (kmBetween(t.where, loc) ?? Infinity) <= SAME_TOWN_KM);
    if (same) same.also.push(place);
    else towns.push({ place, also: [], where: loc, era: eraFor(by, [0, 0]) });
  }
  for (const t of towns) {
    const members = [t.place, ...t.also];
    // The town is named for the place with years (Glasgow, not Govan), or the first one told.
    t.place = members.find((m) => m.fromYear !== null) ?? t.place;
    t.also = members.filter((m) => m !== t.place);
    const dated = members.filter((m) => m.fromYear !== null).map((m) => eraForPlace(m, by));
    const range = dated.length ? { from: Math.min(...dated.map((r) => r.from)), to: Math.max(...dated.map((r) => r.to)) } : eraForPlace(t.place, by);
    t.era = eraFor(by, [range.from, range.to]);
  }
  return towns;
}

/**
 * Qloo research after Go for it (never during the chat), per town and era, all towns at once (A4): venues the story
 * names first (the Barrowland), then artists from decade tags (the town's own music first: Scottish, then British, then
 * anywhere), films and TV from release years around the town, historic places, and things like each love. Qloo gets
 * years, places and taste entities only: never names or steer-clear topics. Everything passes the steer-clear list.
 * Artists become songs (the model's picks, checked on MusicBrainz). The gallery opens as soon as the first town is in.
 * Returns the person with the new cards, ready to save.
 */
export async function researchPerson(p: Person, emit: Emit, onCall: OnCall, abortSignal?: AbortSignal, onEarly?: (early: Person) => Promise<void>): Promise<Person> {
  const by = birthYearOf(p)!;
  const places = placesToResearch(p);
  const drafts = new Map<string, Draft[]>();
  const where = await resolvePlaces(places, onCall);
  const towns = townsOf(places, where, by);
  // Where their loves come from, for "more like" picks and stand-ins: never the town they live in now.
  const origin = loveOrigin(p, where);
  const done: { key: string; place: Place | null }[] = [];
  // Saves run one after another, each with every town finished so far.
  let saving = Promise.resolve();
  const saveEarly = () => {
    if (!onEarly) return;
    const keys = [...done];
    saving = saving.then(() => onEarly({ ...withCards(p, keys, drafts, true), researched: { ...withCards(p, keys, drafts, true).researched, [SONGS_PENDING]: new Date().toISOString() } })).catch((e) => console.error("early save failed", e instanceof Error ? e.message : e));
  };

  // Venues the family named, found on Qloo (A5): their own words, ahead of anything Qloo suggests. Looked up while the
  // towns are.
  const venues = storyVenues(p, towns, onCall).then((story) => {
    if (!story.length) return;
    drafts.set(STORY_KEY, story);
    emit({ type: "step-start", id: "story", tool: "story_places", title: "Places from their story", running: `Finding ${story.map((d) => d.title).join(", ")} on Qloo` });
    emit({ type: "step-end", id: "story", ok: true, summary: `From the story: ${story.map((d) => d.title).join(", ")}.`, items: [], chips: story.map((d) => d.title), sources: ["Qloo"], sourceLine: "their story · Qloo" });
    done.push({ key: STORY_KEY, place: null });
  });

  // Loves Qloo's search doesn't know: each gets an honest stand-in from the same years and town (IM-5).
  const misses: Miss[] = [];
  // Films, TV and books the family named: Qloo's year and picture for their tiles (A14).
  const loves = Promise.all(
    p.loves.map(async (l) => {
      const types = l.type === "film" ? "urn:entity:movie" : l.type === "tv" ? "urn:entity:tv_show" : l.type === "book" ? "urn:entity:book" : null;
      if (!types || l.source === "ring_a_bell" || (l.image && l.year)) return l;
      const match = await get("/search", { query: l.title, types, take: 3 }, onCall)
        .then((r) => pickByName(parseSearch(r.data), l.title) ?? null)
        .catch(() => null);
      if (!match) misses.push({ title: l.title, type: l.type as "film" | "tv" | "book" });
      return match ? { ...l, year: l.year ?? match.year, ...(match.image && !l.image ? { image: match.image } : {}) } : l;
    }),
  );

  await Promise.all([
    venues,
    ...towns.map(async ({ place, also, where: loc, era }) => {
      const years = describeEra(era);
      const id = `place-${place.id}`;
      const named = [place, ...also].map((x) => x.name).join(" and ");
      emit({ type: "step-start", id, tool: "research_place", title: `${named}, ${years}`, running: `Looking up songs, films, TV and places for ${named} in ${years}` });
      const found: Draft[] = [];
      const sources = new Set<string>();
      const call: OnCall = (log) => {
        onCall(log);
        if (log.status === 200) sources.add(log.servedBy === "notonq" ? "NotOnQ" : "Qloo");
      };
      try {
        // A place that timed out gets one more go with longer budgets (F5: Madrid timed out in the live run).
        found.push(
          ...(await researchPlace(p, place, loc, era, call, false, origin).catch((error) => {
            if (!(error instanceof QlooError)) throw error;
            console.error("bell research retry", place.name, error.message);
            return researchPlace(p, place, loc, era, call, true, origin);
          })),
        );
        emit({
          type: "step-end",
          id,
          ok: found.length > 0,
          summary: found.length ? `${p.preferredName || "They"} may know these from ${place.name} in ${years}: ${tally(found)}.` : `Qloo had nothing for ${place.name} in ${years}.`,
          items: [],
          // A few of each kind, so the films, telly and places show as well as the music.
          chips: (["artist", "film", "tv", "place", "book"] as const).flatMap((t) => found.filter((d) => d.type === t).slice(0, t === "artist" ? 3 : 2)).map((d) => d.artist ?? d.title),
          sources: sources.size ? [...sources] : ["Qloo"],
          // Which way the town's own music came (NotOnQ's era fill, or Qloo direct), to see it in the run.
          sourceLine: `${era.decades.map((d) => d.short).join(" and ")} · ${loc?.label ?? place.name} · Qloo${localVia(found)}`,
        });
      } catch (error) {
        if (!(error instanceof QlooError)) throw error;
        console.error("bell research failed", place.name, error.message);
        emit({ type: "step-end", id, ok: false, summary: `Qloo didn't answer in time for ${place.name}. Try again in a minute.`, items: [], chips: [], sources: ["Qloo"] });
      }
      drafts.set(researchKey(place, by), found);
      done.push({ key: researchKey(place, by), place });
      // The places in the same town are researched with it: nothing of their own to look up.
      for (const x of also) {
        drafts.set(researchKey(x, by), []);
        done.push({ key: researchKey(x, by), place: x });
      }
      // The first town in opens the gallery; each later one adds to it.
      saveEarly();
    }),
  ]);

  // The artists the family named become songs too, first on the shelf: their own music beats era picks.
  const named = p.loves.filter((l) => l.type === "artist" && l.source !== "ring_a_bell" && !steersClear(p, l.title));
  if (named.length) {
    const family: Draft[] = await Promise.all(
      named.map(async (l) => {
        // Qloo knows the artist: their picture for the tile (and the name as credited).
        const match = await get("/search", { query: l.title, types: "urn:entity:artist", take: 3 }, onCall)
          .then((r) => pickByName(parseSearch(r.data), l.title) ?? parseSearch(r.data)[0] ?? null)
          .catch(() => null);
        if (!match) misses.push({ title: l.title, type: "artist" });
        return { placeId: "family", type: "artist" as const, title: l.title, year: l.year ?? null, eraFrom: by + 10, eraTo: by + 40, parts: ["the family", l.title], source: `The family said ${p.preferredName || "they"} loved ${l.title}.`, ...(match?.image ? { image: match.image } : {}) };
      }),
    );
    drafts.set(FAMILY_KEY, family);
    done.push({ key: FAMILY_KEY, place: null });
    emit({ type: "step-start", id: "family", tool: "family_music", title: "From what the family told me", running: `Finding a song each for ${named.map((l) => l.title).join(", ")}` });
    emit({ type: "step-end", id: "family", ok: true, summary: `The family named ${named.map((l) => l.title).join(", ")}: their songs go first.`, items: [], chips: named.map((l) => l.title), sources: [], sourceLine: "the family" });
  }
  await saving;
  const keys = [...done];

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
      if (/^test song\b/i.test(pick.title)) continue;
      const ok = offline() ? true : await checkSong(pick.artist?.trim() || d.title, pick.title).then((r) => r.found).catch(() => false);
      if (!ok) continue;
      confirmed++;
      // A recording from outside the place's era (by more than a year) isn't kept: the era is the point.
      if (pick.year && d.eraFrom && d.eraTo && (pick.year < d.eraFrom - 1 || pick.year > d.eraTo + 1)) continue;
      const by = pick.artist?.trim() || d.title;
      Object.assign(d, { type: "song", artist: by, by, title: pick.title, year: pick.year ?? d.year, parts: [...d.parts, ...(offline() ? [] : ["MusicBrainz"])] });
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

  // Stand-ins from where their loves come from (Raj Kapoor's films: an Indian film from Amritsar, never The Sound of
  // Music from Bradford), else the first town. None from there: no stand-in.
  const home = origin ? towns.find((t) => countryName(t.where) === origin.country) : towns[0];
  const standIns = home ? standInsFor(misses, drafts.get(researchKey(home.place, by)) ?? [], home.place.name, p.preferredName) : [];
  if (standIns.length) {
    drafts.set(STAND_INS_KEY, standIns);
    keys.push({ key: STAND_INS_KEY, place: null });
    emit({ type: "step-start", id: "stand-ins", tool: "stand_ins", title: "Stand-ins", running: "Finding stand-ins for what Qloo didn't know" });
    emit({ type: "step-end", id: "stand-ins", ok: true, summary: standIns.map((d) => `Couldn’t find ‘${d.standIn}’ on Qloo: ${d.title} from the same years and town instead, as a new try.`).join(" "), items: [], chips: standIns.map((d) => d.title), sources: ["Qloo"], sourceLine: "stand-ins · Qloo" });
  }
  const final = withCards(p, keys, drafts, false);
  const { [SONGS_PENDING]: _pending, ...researched } = final.researched;
  void _pending;
  return { ...final, researched, loves: await loves };
}

type Miss = { title: string; type: "artist" | "film" | "tv" | "book" };

/**
 * One stand-in per love Qloo's search didn't know (IM-5): the top song for an artist, else the top film, show or book
 * of the same type, moved from the home town's own look-up. Labelled, and a new try until a log proves it.
 */
export function standInsFor(misses: Miss[], found: Draft[], town: string, name: string): Draft[] {
  const used = new Set<string>();
  return misses.flatMap((m) => {
    const want = m.type === "artist" ? "song" : m.type;
    const pick = found.find((d) => d.type === want && !used.has(d.title) && nameKey(d.by ?? d.title) !== nameKey(m.title));
    if (!pick) return [];
    used.add(pick.title);
    // Moved, not copied: one card, labelled as the stand-in.
    found.splice(found.indexOf(pick), 1);
    const { artist, ...card } = pick;
    void artist;
    return [{ ...card, standIn: m.title, like: undefined, source: `Stand-in: Qloo didn’t know ‘${m.title}’, so this is a top pick from ${name || "their"}’s years in ${town}.` } satisfies Draft];
  });
}

/** "· local music via NotOnQ" or "· local music: Qloo", from the parts of the town's own artists; nothing when none. */
function localVia(found: Draft[]): string {
  const local = found.filter((d) => d.type === "artist" && d.parts.length >= 4 && !d.parts[1]?.startsWith("like "));
  if (!local.length) return "";
  return local.some((d) => d.parts.includes("via NotOnQ")) ? " · local music via NotOnQ" : " · local music: Qloo";
}

/** Venues named in the story, found on Qloo. */
export const STORY_KEY = "story";

/**
 * The venues the family named ("went dancing at the Barrowland"), searched on Qloo in the town where it happened (the
 * place they lived that year, else the first). Only a sure match counts (`pickVenue`): never a hotel nearby, never a guess.
 */
async function storyVenues(p: Person, towns: Town[], onCall: OnCall): Promise<Draft[]> {
  const venueOf = (label: string, venue?: string) => venue?.trim() || /\bat (?:the )?([A-Z][\w'’]+(?: [A-Z][\w'’]+)*)/.exec(label)?.[1] || null;
  const asks = talkingPoints(p)
    .map((m) => ({ m, venue: venueOf(m.label, m.venue) }))
    .filter((x): x is { m: Person["moments"][number]; venue: string } => Boolean(x.venue) && !steersClear(p, x.venue ?? undefined))
    .slice(0, 3);
  const out = await Promise.all(
    asks.map(async ({ m, venue }) => {
      const town = (m.year ? towns.find((t) => [t.place, ...t.also].some((x) => x.fromYear !== null && x.fromYear <= m.year! && (x.toYear === null || m.year! < x.toYear))) : null) ?? towns[0];
      if (!town) return null;
      const results = await get("/search", { query: `${venue} ${town.place.name}`, types: "urn:entity:place", take: 5 }, onCall)
        .then((r) => parseSearch(r.data))
        .catch(() => []);
      const hit = pickVenue(venue, results);
      if (!hit) return null;
      return { placeId: town.place.id, type: "place" as const, title: hit.name, year: m.year, parts: ["their story", town.place.name, "Qloo"], source: `Named in ${p.preferredName || "their"}’s story; Qloo found the place in ${town.place.name}.`, qlooId: hit.id, fromStory: m.label, ...(hit.image ? { image: hit.image } : {}) } satisfies Draft;
    }),
  );
  return out.filter((d): d is NonNullable<typeof d> => d !== null);
}

/** Marks a person whose songs are still being checked (the gallery says so, and refreshes until they land). */
export const SONGS_PENDING = "songs-pending";

/** Whether a look-up is still checking songs (a mark older than 5 minutes is a look-up that died, not one running). */
export function songsPending(p: Person, now = new Date()): boolean {
  const at = p.researched[SONGS_PENDING];
  return Boolean(at) && now.getTime() - new Date(at).getTime() < 5 * 60_000;
}

/** The person with the drafts as cards; `early` keeps their old songs, as the new ones aren't checked yet. */
function withCards(p: Person, keys: { key: string; place: Place | null }[], drafts: Map<string, Draft[]>, early: boolean): Person {
  const suggestions = { ...p.suggestions };
  const researched = { ...p.researched };
  for (const { key, place } of keys) {
    const old = new Map((suggestions[key] ?? []).map((s) => [nameKey(s.title), s]));
    const keepOldSongs = early ? (suggestions[key] ?? []).filter((s) => s.type === "song") : [];
    const fresh = (drafts.get(key) ?? []).filter((d) => d.type !== "artist" && !steersClear(p, d.title, d.by));
    // Answers already given stay with their card.
    suggestions[key] = fresh.map((d, i) => {
      const before = old.get(nameKey(d.title));
      const { artist, ...card } = d;
      void artist;
      return { ...card, id: before?.id ?? `${place?.id ?? "family"}-${i}-${nameKey(d.title).replace(/\s+/g, "-").slice(0, 24)}`, ...(before?.answer ? { answer: before.answer } : {}) };
    });
    suggestions[key] = [...suggestions[key], ...keepOldSongs.filter((s) => !suggestions[key].some((c) => nameKey(c.title) === nameKey(s.title)))];
    // Researched only once the songs are in: an early save that's cut off gets looked up again.
    if (place && !early) researched[key] = researchInputs(p, place);
  }
  return { ...p, suggestions, researched };
}

async function researchPlace(p: Person, place: Place, loc: Locality | null, era: ReturnType<typeof eraFor>, onCall: OnCall, slow = false, origin: Origin | null = null): Promise<Draft[]> {
  const name = place.name;
  // A retry after a timeout gets longer budgets (F5); the local-music call always gets NotOnQ time for its era fill (F2).
  const budget: CallOptions = slow ? { qlooTimeoutMs: 40_000, notonqTimeoutMs: 10_000 } : {};
  // Artist calls with a music tag can wake NotOnQ's era fill (MusicBrainz, 1 request a second; 4–14 s cold): at least
  // 20 s, and once more a few seconds on if the fill was still cold (served by Qloo, gap G4).
  const get = (path: string, params: QlooParams, onCall: OnCall, extra?: CallOptions) => qlooGet<unknown>(path, params, onCall, musicCallOptions(params, { ...budget, ...extra }));
  const country = countryName(loc);
  const ownMusicOnly = !globalIsLocal(loc);
  // Qloo is asked with the pinned town ("Glasgow, United Kingdom"), never a bare name it could put in Kentucky.
  const where = loc?.query ?? place.name;
  const years = describeEra(era);
  const out: Draft[] = [];
  const seen = new Set<string>();
  const add = (d: Draft) => {
    const k = `${d.type}:${nameKey(d.title)}`;
    if (seen.has(k) || steersClear(p, d.title)) return;
    seen.add(k);
    out.push(d);
  };
  const via = (r: { servedBy?: string }) => (r.servedBy === "notonq" ? "via NotOnQ" : "Qloo");

  // The era's decade tags (a decade the era barely touches, a single year, would bring that decade's sound, not theirs).
  const decades = era.decades.filter((x) => x.years >= 2 || era.decades.length === 1);
  const tags = (
    await Promise.all(
      decades.map(async (d) => {
        const { data } = await get("/v2/tags", { "filter.query": d.short, "filter.tag.types": "urn:tag:genre:music", take: 15 }, onCall);
        const tag = pickDecadeTag(parseTags(data), d.start);
        return tag ? { short: d.short, id: tag.id, years: d.years } : null;
      }),
    )
  ).filter((t): t is NonNullable<typeof t> => t !== null);
  const lead = [...tags].sort((a, b) => b.years - a.years)[0];
  const share = (t: { years: number }) => Math.max(2, Math.round((PER_PLACE.artists * t.years) / Math.max(1, era.to - era.from + 1)));
  const local = localTags(loc);
  // Outside the English-speaking world the decade's global hits aren't theirs (F3): no top-up from them.
  const skipGlobal = ownMusicOnly && local.length > 0;

  // Warm the place first (HQ's NotOnQ diagnosis): the decade and the place, no country tag, so NotOnQ resolves and
  // caches the place before the country-tagged calls. One per place; in the UK it's the era call below, cached.
  if (lead) await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.tags": lead.id, "signal.location.query": where, take: 10 }, onCall).catch(() => null);

  const [localArtists, eraArtists, likes, books, screen, historic] = await Promise.all([
    // The town's own music first (A5): the decade and the most local tag Qloo has for it (Scottish, then British).
    Promise.all(
      tags.map(async (t) => {
        let best: { t: typeof t; l: (typeof local)[number]; r: Awaited<ReturnType<typeof get>>; found: QlooEntity[] } | null = null;
        for (const l of local) {
          // Through NotOnQ with time for its era fill: Qloo alone has one 60s Spanish artist; NotOnQ finds Mocedades,
          // Paco de Lucía, Camarón… from MusicBrainz in about 8 s (live probe, 31 Oct).
          const params = { "filter.type": "urn:entity:artist", "filter.tags": `${t.id},${l.tag}`, "operator.filter.tags": "intersection", "signal.location.query": where, take: 8 };
          const r = await get("/v2/insights", params, onCall, slow ? { notonqTimeoutMs: 25_000 } : undefined).catch(() => null);
          const found = r ? parseInsights(r.data) : [];
          if (found.length >= 2) return { t, l, r: r!, found };
          // Elsewhere, what's there is shown, however little: never another country's music to fill.
          if (ownMusicOnly && r && found.length > (best?.found.length ?? 0)) best = { t, l, r, found };
        }
        return best;
      }),
    ),
    // Then the decade's artists around the town, for whatever the local ones leave.
    Promise.all(tags.map(async (t) => ({ t, r: skipGlobal ? null : await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.tags": t.id, "signal.location.query": where, take: 10 }, onCall) }))),
    // Things like what they love, in that decade and town: a film seeds music, a dance hall its era's songs.
    Promise.all(
      p.loves
        .filter((l) => l.source !== "ring_a_bell")
        .slice(0, PER_PLACE.likes)
        .map(async (love) => {
          const types = love.type === "film" ? "urn:entity:movie" : love.type === "tv" ? "urn:entity:tv_show" : "urn:entity:artist";
          const q = love.by && love.type === "song" ? love.by : love.title;
          const s = await get("/search", { query: q, types, take: 5 }, onCall);
          const match = pickByName(parseSearch(s.data), q);
          if (!match) return null;
          // Music from where the love comes from (Amrit's Rafi: Punjabi, even in Bradford), else, outside the
          // English-speaking world, the town's own (Morandi came "like Rocío Jurado" for Sevilla): the decade and that
          // tag together, or nothing.
          const from = origin?.tags[0] ?? (ownMusicOnly ? local[0] : undefined);
          const own = from ? { "filter.tags": [lead?.id, from.tag].filter(Boolean).join(","), "operator.filter.tags": "intersection" } : { "filter.tags": lead?.id };
          const r = await get("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": match.id, ...own, "signal.location.query": where, take: 4 }, onCall);
          return { match, found: parseInsights(r.data) };
        }),
    ),
    // Books like the ones the family mentioned (Qloo's book years are editions, so books come from their own loves).
    Promise.all(
      p.loves
        .filter((l) => l.type === "book")
        .slice(0, 2)
        .map(async (love) => {
          const s = await get("/search", { query: love.title, types: "urn:entity:book", take: 5 }, onCall);
          const match = pickByName(parseSearch(s.data), love.title);
          if (!match) return null;
          const r = await get("/v2/insights", { "filter.type": "urn:entity:book", "signal.interests.entities": match.id, take: 5 }, onCall);
          return { match, found: parseInsights(r.data) };
        }),
    ),
    // Films and TV from the era's release years, popular around the town.
    Promise.all(
      ([["film", "urn:entity:movie", PER_PLACE.films], ["tv", "urn:entity:tv_show", PER_PLACE.tv]] as const).map(async ([kind, type, n]) => {
        // No horror: it was in the live results (Halloween for Blackpool, 1972–80), and it isn't for a care home.
        // Outside the English-speaking world, the country's own releases (F4): "Spain" (Qloo wants the name, not "ES").
        // With the country filter the place signal goes: together they return nothing (live probe, 31 Oct).
        const byCountry = ownMusicOnly && country ? { "filter.release_country": country } : {};
        const base = { "filter.type": type, "filter.release_year.min": era.from, "filter.release_year.max": era.to, "filter.exclude.tags": NO_HORROR, ...byCountry, take: 8 };
        let found = parseInsights((await get("/v2/insights", byCountry["filter.release_country"] ? base : { ...base, "signal.location.query": where }, onCall)).data);
        // TV is thin by place (two shows for London in the probes): fall back to the era's TV anywhere. Never for a
        // country filter: fewer cards beat Hollywood fill-ins.
        if (found.length < n && !byCountry["filter.release_country"]) found = [...found, ...parseInsights((await get("/v2/insights", base, onCall)).data)];
        // Co-productions come back too (spaghetti westerns for Spain): the country's own first releases lead.
        if (country && byCountry["filter.release_country"]) found = [...found.filter((e) => e.releaseCountry === country), ...found.filter((e) => e.releaseCountry !== country)];
        return { kind, n, found };
      }),
    ),
    // Long-standing places in the town (Qloo's are today's; these were likely there then too).
    get("/v2/insights", { "filter.type": "urn:entity:place", "filter.location.query": where, "filter.tags": "urn:tag:ambience:qloo:historic", take: 6 }, onCall).then((r) => parseInsights(r.data)),
  ]);

  // Artists: the town's own first, then the decade's around it, in each decade's share of the era.
  for (const t of tags) {
    const mine = localArtists.find((x) => x?.t === t);
    const general = eraArtists.find((x) => x.t === t)!;
    let left = share(t);
    // The town's own came back: no top-up from the decade's hits anywhere (F3).
    const topUp = !mine?.found.length && general.r ? parseInsights(general.r.data) : [];
    for (const e of mine?.found ?? []) {
      if (left <= 0) break;
      const before = out.length;
      add({ placeId: place.id, type: "artist", title: e.name, year: decadeStart(t.short), eraFrom: era.from, eraTo: era.to, parts: [t.short, name, mine!.l.word, via(mine!.r)], source: `Qloo: ${mine!.l.word} artists of the ${t.short}, popular around ${name}.`, qlooId: e.id, ...(e.image ? { image: e.image } : {}) });
      if (out.length > before) left--;
    }
    for (const e of topUp) {
      if (left <= 0) break;
      const before = out.length;
      add({ placeId: place.id, type: "artist", title: e.name, year: decadeStart(t.short), eraFrom: era.from, eraTo: era.to, parts: [t.short, name, via(general.r!)], source: `Qloo: artists popular around ${name} in the ${t.short}.`, qlooId: e.id, ...(e.image ? { image: e.image } : {}) });
      if (out.length > before) left--;
    }
  }
  for (const hit of likes) {
    if (!hit) continue;
    for (const e of hit.found.filter((x) => nameKey(x.name) !== nameKey(hit.match.name)).slice(0, 2)) {
      add({ placeId: place.id, type: "artist", title: e.name, year: lead ? decadeStart(lead.short) : null, eraFrom: era.from, eraTo: era.to, parts: [lead?.short ?? years, `like ${hit.match.name}`, "Qloo"], source: `Qloo: liked by people who like ${hit.match.name}${lead ? `, ${lead.short}` : ""}, around ${name}.`, qlooId: e.id, ...(e.image ? { image: e.image } : {}) });
    }
  }
  for (const hit of books) {
    if (!hit) continue;
    for (const e of hit.found.filter((x) => nameKey(x.name) !== nameKey(hit.match.name)).slice(0, 3)) add({ placeId: place.id, type: "book", title: e.name, year: e.year, parts: ["book", `like ${hit.match.name}`, "Qloo"], source: `Qloo: liked by readers of ${hit.match.name}.`, qlooId: e.id, ...(e.image ? { image: e.image } : {}) });
  }
  for (const { kind, n, found } of screen) {
    for (const e of found.filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i).slice(0, n)) add({ placeId: place.id, type: kind, title: e.name, year: e.year, parts: [kind === "film" ? "film" : "TV", e.year ? String(e.year) : years, "Qloo"], source: `Qloo: ${kind === "film" ? "films" : "TV"} from ${years}, popular around ${name}.`, qlooId: e.id, ...(e.image ? { image: e.image } : {}), ...(e.genres.length || harshKeywords(e.keywords).length ? { genres: [...e.genres, ...harshKeywords(e.keywords)] } : {}), ...(e.popularity !== null ? { popularity: e.popularity } : {}), ...(kind === "tv" && e.finaleYear ? { runTo: e.finaleYear } : {}) });
  }
  for (const e of historic.filter((x) => !isInstitution(x.name) && !isMemorial(x.name, x.categories, x.keywords, x.genres)).slice(0, PER_PLACE.places)) add({ placeId: place.id, type: "place", title: e.name, year: null, parts: ["place", name, "Qloo"], source: `Qloo: a long-standing place in ${name}, still there today.`, qlooId: e.id, ...(e.image ? { image: e.image } : {}) });

  return out;
}

/** "6 artists, 2 films, 2 TV shows and 2 places". */
function tally(found: Draft[]): string {
  const words: [Draft["type"], string, string][] = [["artist", "artist", "artists"], ["film", "film", "films"], ["tv", "TV show", "TV shows"], ["place", "place", "places"], ["book", "book", "books"]];
  const bits = words.map(([t, one, many]) => [found.filter((d) => d.type === t).length, one, many] as const).filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits.at(-1)}` : (bits[0] ?? "");
}

/** "60s" → 1960, "2000s" → 2000. */
function decadeStart(short: string): number {
  const n = Number(short.replace(/\D/g, ""));
  return n >= 1000 ? n : 1900 + n;
}

