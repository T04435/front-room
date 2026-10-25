import "server-only";
import { eraFor, pickDecadeTag, type Decade, type Era } from "@/lib/era";
import { checkCurated, REF_PREFIX, type AskField, type Brief, type ItemType, type Kit, type KitItem } from "@/lib/kit";
import { localityLabel, nameKey, parseInsights, parseSearch, parseTags, pickByName, type QlooEntity } from "@/lib/qloo-parse";
import type { CallLog, QlooParams } from "@/lib/qloo-transport";
import { TOOL_LABELS, type RunEvent } from "@/lib/run-events";
import { curate } from "@/server/curate";
import { offline } from "@/server/env";
import { newKitId, saveKit } from "@/server/kits";
import { checkSong } from "@/server/musicbrainz";
import { QlooError, qlooGet } from "@/server/qloo";

type Emit = (event: RunEvent) => void;

/** Fewer artists than this from the era and place, and the run asks the family what music they loved. */
const MIN_ARTISTS = 5;

/** One run's state: the research so far, its refs, and the Qloo calls it made (for the daily budget). */
class RunState {
  items: KitItem[] = [];
  private counts: Partial<Record<ItemType, number>> = {};
  qlooCalls = 0;
  qlooCached = 0;
  sources = { notonq: 0, qloo: 0, fellBack: 0 };
  avoid: Set<string>;

  constructor(readonly brief: Brief) {
    this.avoid = new Set((brief.avoid ?? []).map(nameKey));
  }

  /** Adds a research item unless it's already there (same type and title) or the family said it isn't for them. */
  add(type: ItemType, e: { id: string | null; name: string; year?: number | null; description?: string | null }, source: string, via: KitItem["via"]): KitItem | null {
    if (this.avoid.has(nameKey(e.name))) return null;
    if (this.items.some((i) => i.type === type && nameKey(i.title) === nameKey(e.name))) return null;
    const n = (this.counts[type] = (this.counts[type] ?? 0) + 1);
    const item: KitItem = { ref: `${REF_PREFIX[type]}${n}`, type, title: e.name, year: e.year ?? null, source, why: null, via, entityId: e.id, ...(type === "place" ? { description: e.description ?? null } : {}) };
    this.items.push(item);
    return item;
  }

  /** A step's Qloo calls: counted for the budget, and summarised as how they went (NotOnQ, Qloo, or both). */
  calls() {
    const logs: CallLog[] = [];
    const onCall = (log: CallLog) => {
      logs.push(log);
      if (log.cached) this.qlooCached++;
      else {
        this.qlooCalls++;
        this.sources[log.via]++;
        if (log.fellBack) this.sources.fellBack++;
      }
    };
    const summary = () => {
      const vias = new Set(logs.filter((l) => l.status === 200).map((l) => l.via));
      return { via: vias.size === 2 ? ("mixed" as const) : ([...vias][0] ?? undefined), fellBack: logs.some((l) => l.fellBack) };
    };
    return { onCall, summary };
  }
}

async function get(path: string, params: QlooParams, onCall: (log: CallLog) => void) {
  return qlooGet<unknown>(path, params, onCall);
}

type StepResult = { ok: boolean; summary: string; items: KitItem[] };

/** Runs one research step: its start and end events, its calls' sources. A Qloo error ends the step, not the run. */
async function step(state: RunState, emit: Emit, id: string, tool: string, work: (onCall: (log: CallLog) => void) => Promise<StepResult>): Promise<StepResult> {
  emit({ type: "step-start", id, tool, label: TOOL_LABELS[tool] ?? tool });
  const { onCall, summary } = state.calls();
  let result: StepResult;
  try {
    result = await work(onCall);
  } catch (error) {
    if (!(error instanceof QlooError)) throw error;
    console.error("qloo step failed", tool, error.message);
    result = { ok: false, summary: "Qloo couldn't answer this step just now, so the kit goes on without it.", items: [] };
  }
  emit({ type: "step-end", id, ...result, ...summary() });
  return result;
}

const list = (items: KitItem[], n = 6) => items.slice(0, n).map((i) => i.title).join(", ") + (items.length > n ? ` and ${items.length - n} more` : "");

export type RunDeps = { onQlooCalls?: (calls: number) => Promise<void>; owner?: string | null };

/** One run, streamed as events. `onQlooCalls` gets the live Qloo calls it made however it ended: the daily budget. */
export async function runKit(brief: Brief, emit: Emit, abortSignal?: AbortSignal, deps: RunDeps = {}): Promise<void> {
  const state = new RunState(brief);
  try {
    await run(state, emit, abortSignal, deps.owner ?? null);
  } finally {
    await deps.onQlooCalls?.(state.qlooCalls).catch((e) => console.error("qloo budget count failed", e instanceof Error ? e.message : e));
  }
}

async function run(state: RunState, emit: Emit, abortSignal: AbortSignal | undefined, owner: string | null): Promise<void> {
  const started = Date.now();
  const { brief } = state;
  const era = eraFor(brief.birthYear);

  // 1. The place, as Qloo knows it. Qloo's location signals take a place name; one it can't find gets the question.
  const typed = brief.answers?.nearbyPlace ?? brief.place;
  let placeLabel = typed;
  const found = await step(state, emit, "find-place", "find_place", async (onCall) => {
    const { data } = await get("/search", { query: typed, types: "urn:entity:locality", take: 5 }, onCall);
    const results = parseSearch(data);
    const match = pickByName(results, typed.split(",")[0]) ?? results[0];
    if (!match) return { ok: false, summary: `Qloo doesn't know "${typed}" as a town or city.`, items: [] };
    placeLabel = localityLabel(match);
    return { ok: true, summary: `${placeLabel}. ${brief.name ?? "They"} turned 15 in ${era.from} and 25 in ${era.to}.`, items: [] };
  });
  if (!found.ok) return ask(emit, ["nearbyPlace"], `Qloo doesn't know "${typed}" yet. Which bigger town or city was nearby?`);
  // Qloo's location signal takes the place's name (verified with "Manchester", 25 Oct).
  const where = typed;

  // 2. The era's music tags: Qloo files music by decade ("60s", "eighties").
  const decades: (Decade & { tag: { id: string; name: string } })[] = [];
  await step(state, emit, "era-tags", "era_tags", async (onCall) => {
    for (const d of era.decades) {
      const { data } = await get("/v2/tags", { "filter.query": d.short, "filter.tag.types": "urn:tag:genre:music", take: 15 }, onCall);
      const tag = pickDecadeTag(parseTags(data), d.start);
      if (tag) decades.push({ ...d, tag });
    }
    const named = decades.map((d) => `${d.short} (${d.years} of their years)`).join(" and ");
    return decades.length ? { ok: true, summary: `Qloo's decade tags for ${era.from}–${era.to}: ${named}.`, items: [] } : { ok: false, summary: "Qloo has no decade tag for these years.", items: [] };
  });

  // 3. In parallel: the era's artists around the hometown, the family's likes, the films and TV of those years, and
  // the hometown's long-standing places.
  const [artists] = await Promise.all([
    step(state, emit, "era-artists", "era_artists", (onCall) => eraArtists(state, decades, where, placeLabel, onCall)),
    brief.likes?.length ? step(state, emit, "likes", "likes", (onCall) => likes(state, brief.likes!, decades, onCall)) : null,
    step(state, emit, "era-films", "era_films", (onCall) => screen(state, "film", era, where, placeLabel, onCall)),
    step(state, emit, "era-tv", "era_tv", (onCall) => screen(state, "tv", era, where, placeLabel, onCall)),
    step(state, emit, "era-places", "era_places", (onCall) => places(state, where, placeLabel, onCall)),
  ]);

  // 4. Thin music: words from the family, else the question.
  let artistCount = state.items.filter((i) => i.type === "artist").length;
  if (artistCount < MIN_ARTISTS && brief.answers?.musicWords) {
    await step(state, emit, "music-words", "music_words", (onCall) => musicWords(state, brief.answers!.musicWords!, decades, where, onCall));
    artistCount = state.items.filter((i) => i.type === "artist").length;
  }
  if (artistCount < MIN_ARTISTS) {
    return ask(emit, ["musicWords"], `Qloo found ${artists.items.length ? `only ${artistCount} artists` : "no artists"} for ${placeLabel} in ${era.from}–${era.to}. What kind of music did they love? A singer, a band or a style helps.`);
  }
  if (abortSignal?.aborted) return;

  // 5. The kit: the curator picks the songs and orders them, picks films, TV and places to talk about, and writes the
  // prompts, all citing the research.
  emit({ type: "note", text: `Building the session kit from ${state.items.length} researched items.` });
  emit({ type: "curating", itemCount: state.items.length });
  const { curated, model } = await curate(
    { place: placeLabel, era, name: brief.name, items: state.items, avoid: brief.avoid },
    abortSignal,
    () => emit({ type: "note", text: "The kit came back unreadable, so it's built once more." }),
  );
  const checked = checkCurated(curated, state.items);
  if (checked.problems.length) console.warn("curator problems", checked.problems);
  const items = await checkSongs(checked.items, emit);
  const known = new Set(items.map((i) => i.ref));
  const prompts = checked.prompts.filter((p) => p.refs.every((r) => known.has(r)));
  if (items.filter((i) => i.type === "song").length < 4) {
    emit({ type: "error", message: "The kit came back with too few songs. Try again in a minute." });
    return;
  }
  const kit: Kit = {
    id: newKitId(),
    brief: { name: brief.name, birthYear: brief.birthYear, place: brief.place, likes: brief.likes, avoid: brief.avoid },
    place: placeLabel,
    era,
    items,
    prompts,
    summary: curated.summary,
    sources: state.sources,
    model,
    createdAt: new Date().toISOString(),
  };
  // A failed save keeps the kit on the page, just without a link.
  await saveKit(kit, owner).catch((e) => {
    console.error("save kit failed", e instanceof Error ? e.message : e);
    kit.id = "";
  });
  emit({ type: "kit", kit });
  emit({ type: "done", qlooCalls: state.qlooCalls, qlooCached: state.qlooCached, seconds: Math.round((Date.now() - started) / 1000) });
}

function ask(emit: Emit, fields: AskField[], message: string) {
  emit({ type: "ask", fields, message });
}

const viaOf = (r: { via: NonNullable<KitItem["via"]> }) => r.via;

/** The era's artists, decade by decade, popular around the place (decade tag + location signal). The bigger decade gets more. */
async function eraArtists(state: RunState, decades: (Decade & { tag: { id: string } })[], where: string, label: string, onCall: (log: CallLog) => void): Promise<StepResult> {
  const added: KitItem[] = [];
  for (const d of decades) {
    const r = await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.tags": d.tag.id, "signal.location.query": where, take: 12 }, onCall);
    const share = d.years >= 6 ? 8 : 6;
    for (const e of parseInsights(r.data).slice(0, share)) {
      const item = state.add("artist", e, `Qloo: ${d.short} music, popular around ${label}`, viaOf(r));
      if (item) added.push(item);
    }
  }
  return added.length
    ? { ok: true, summary: `Around ${label}: ${list(added)}.`, items: added }
    : { ok: false, summary: `Qloo has no ${decades.map((d) => d.short).join(" or ")} artists for ${label}.`, items: [] };
}

/** What the family knows: an artist Qloo knows brings era artists like them; anything else is kept as the family said it. */
async function likes(state: RunState, names: string[], decades: { tag: { id: string }; short: string }[], onCall: (log: CallLog) => void): Promise<StepResult> {
  const added: KitItem[] = [];
  for (const name of names.slice(0, 3)) {
    const r = await get("/search", { query: name, types: "urn:entity:artist", take: 5 }, onCall);
    const match: QlooEntity | undefined = pickByName(parseSearch(r.data), name);
    if (!match) {
      const item = state.add("family", { id: null, name }, "The family", null);
      if (item) added.push(item);
      continue;
    }
    const own = state.add("artist", match, "Qloo: the artist the family named", viaOf(r));
    if (own) added.push(own);
    const decade = decades[0];
    const similar = await get(
      "/v2/insights",
      { "filter.type": "urn:entity:artist", "signal.interests.entities": match.id, "filter.tags": decade?.tag.id, take: 6 },
      onCall,
    );
    for (const e of parseInsights(similar.data).slice(0, 3)) {
      const item = state.add("artist", e, `Qloo: ${decade ? `${decade.short} artists` : "artists"} liked by ${match.name}'s fans`, viaOf(similar));
      if (item) added.push(item);
    }
  }
  return { ok: added.length > 0, summary: added.length ? `From what the family knows: ${list(added)}.` : "Nothing found for the family's picks.", items: added };
}

/** Films or TV released in the era years, popular around the place. TV is thin by place, so it tries without the place too. */
async function screen(state: RunState, kind: "film" | "tv", era: Era, where: string, label: string, onCall: (log: CallLog) => void): Promise<StepResult> {
  const type = kind === "film" ? "urn:entity:movie" : "urn:entity:tv_show";
  const base = { "filter.type": type, "filter.release_year.min": era.from, "filter.release_year.max": era.to, take: kind === "film" ? 10 : 8 };
  const added: KitItem[] = [];
  const r = await get("/v2/insights", { ...base, "signal.location.query": where }, onCall);
  for (const e of parseInsights(r.data).slice(0, 6)) {
    const item = state.add(kind, e, `Qloo: ${kind === "film" ? "films" : "TV"} from ${era.from}–${era.to}, popular around ${label}`, viaOf(r));
    if (item) added.push(item);
  }
  if (kind === "tv" && added.length < 3) {
    const wide = await get("/v2/insights", base, onCall);
    for (const e of parseInsights(wide.data).slice(0, 4 - added.length)) {
      const item = state.add("tv", e, `Qloo: TV from ${era.from}–${era.to}`, viaOf(wide));
      if (item) added.push(item);
    }
  }
  const what = kind === "film" ? "films" : "TV shows";
  return added.length ? { ok: true, summary: `${list(added)}.`, items: added } : { ok: false, summary: `Qloo has no ${what} from ${era.from}–${era.to} here.`, items: [] };
}

/** The family's words ("Irish ballads", "Elvis and rock'n'roll") as Qloo genres, then era artists in them near the place. */
async function musicWords(state: RunState, words: string, decades: { tag: { id: string }; short: string }[], where: string, onCall: (log: CallLog) => void): Promise<StepResult> {
  const t = await get("/v2/tags", { "filter.query": words, "filter.tag.types": "urn:tag:genre:music", "feature.semantic_search": true, take: 3 }, onCall);
  const genres = parseTags(t.data);
  if (!genres.length) return { ok: false, summary: `Qloo found no music matching "${words}".`, items: [] };
  const added: KitItem[] = [];
  const r = await get(
    "/v2/insights",
    { "filter.type": "urn:entity:artist", "signal.interests.tags": genres.map((g) => g.id).join(","), "filter.tags": decades[0]?.tag.id, "signal.location.query": where, take: 10 },
    onCall,
  );
  for (const e of parseInsights(r.data).slice(0, 8)) {
    const item = state.add("artist", e, `Qloo: ${genres.map((g) => g.name).join(", ")} (the family's words)${decades[0] ? `, ${decades[0].short}` : ""}`, viaOf(r));
    if (item) added.push(item);
  }
  return { ok: added.length > 0, summary: added.length ? `"${words}" → ${genres.map((g) => g.name).join(", ")}: ${list(added)}.` : `No artists for "${words}".`, items: added };
}

/**
 * Long-standing places in the hometown: Qloo's places are today's, so the run asks for the ones tagged historic (a
 * Victorian theatre, a 1930s library, a cricket ground), which were likely there in their youth too. The curator picks
 * the ones worth a conversation, and the kit says they're still there today, not that they went.
 */
async function places(state: RunState, where: string, label: string, onCall: (log: CallLog) => void): Promise<StepResult> {
  const r = await get("/v2/insights", { "filter.type": "urn:entity:place", "filter.location.query": where, "filter.tags": "urn:tag:ambience:qloo:historic", take: 10 }, onCall);
  const added: KitItem[] = [];
  for (const e of parseInsights(r.data).slice(0, 8)) {
    const item = state.add("place", e, `Qloo: historic places in ${label}, still there today`, viaOf(r));
    if (item) added.push(item);
  }
  return added.length ? { ok: true, summary: `${list(added)}.`, items: added } : { ok: false, summary: `Qloo has no historic places listed for ${label}.`, items: [] };
}

/** Fewest songs a kit keeps: below this, titles MusicBrainz can't find stay in (marked unchecked) rather than leave a thin playlist. */
const MIN_SONGS = 5;

/**
 * Checks each song title the curator picked against MusicBrainz (one call a second). A confirmed song takes
 * MusicBrainz's first release year; a title it can't find is dropped (a made-up title must not reach staff) unless
 * that would leave fewer than MIN_SONGS. If MusicBrainz can't be reached, songs stay, marked unchecked. Offline: no calls.
 */
async function checkSongs(items: KitItem[], emit: Emit): Promise<KitItem[]> {
  const songs = items.filter((i) => i.type === "song");
  if (offline()) return items.map((i) => (i.type === "song" ? { ...i, check: "unchecked" as const } : i));
  emit({ type: "step-start", id: "check-songs", tool: "check_songs", label: TOOL_LABELS.check_songs });
  const results = new Map<string, "found" | "missing" | "error">();
  const years = new Map<string, number>();
  for (const s of songs) {
    try {
      const r = await checkSong(s.by!.title, s.title);
      results.set(s.ref, r.found ? "found" : "missing");
      if (r.year) years.set(s.ref, r.year);
    } catch (error) {
      console.error("musicbrainz check failed", error instanceof Error ? error.message : error);
      results.set(s.ref, "error");
    }
  }
  const missing = songs.filter((s) => results.get(s.ref) === "missing");
  const drop = new Set(songs.length - missing.length >= MIN_SONGS ? missing.map((s) => s.ref) : []);
  const kept = items
    .filter((i) => !drop.has(i.ref))
    .map((i): KitItem => {
      if (i.type !== "song") return i;
      const found = results.get(i.ref) === "found";
      return {
        ...i,
        year: years.get(i.ref) ?? i.year,
        check: found ? "musicbrainz" : "unchecked",
        source: found ? `AI pick, confirmed on MusicBrainz: a recording by ${i.by!.title} (${i.by!.ref})` : i.source,
      };
    });
  const confirmed = songs.filter((s) => results.get(s.ref) === "found").length;
  const dropped = [...drop].map((r) => songs.find((s) => s.ref === r)!.title);
  emit({
    type: "step-end",
    id: "check-songs",
    ok: confirmed > 0,
    summary: `${confirmed} of ${songs.length} titles confirmed as real recordings.${dropped.length ? ` Dropped, not found: ${dropped.join(", ")}.` : ""}${songs.length - confirmed - dropped.length ? ` ${songs.length - confirmed - dropped.length} couldn't be checked and are marked so.` : ""}`,
    items: [],
  });
  return kept;
}
