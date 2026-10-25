import "server-only";
import { describeEra, eraFor, pickDecadeTag, type Decade, type Era } from "@/lib/era";
import { checkCurated, REF_PREFIX, type AskField, type Brief, type ItemType, type Kit, type KitItem } from "@/lib/kit";
import { localityLabel, nameKey, parseInsights, parseSearch, parseTags, pickByName, type QlooEntity } from "@/lib/qloo-parse";
import type { CallLog, QlooParams, Result } from "@/lib/qloo-transport";
import { possessive, type RunEvent } from "@/lib/run-events";
import { curate } from "@/server/curate";
import { offline } from "@/server/env";
import { newKitId, saveKit } from "@/server/kits";
import { checkSong } from "@/server/musicbrainz";
import { NO_HORROR, QlooError, qlooGet } from "@/server/qloo";

type Emit = (event: RunEvent) => void;
type OnCall = (log: CallLog) => void;

/** Fewer artists than this from the era and place, and the run asks the family what music they loved. */
const MIN_ARTISTS = 5;
/** With "Skip this" on that question, the run carries on if it has at least this many. */
const MIN_ARTISTS_SKIPPED = 2;
/** Fewest songs a kit needs. */
const MIN_SONGS = 3;

/** Where an item came from: its source line's parts, the sentence behind them, and which way the call went. */
type From = { parts: string[]; source: string; result?: Pick<Result<unknown>, "via" | "servedBy">; addedBy?: "family" };

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

  /**
   * Adds a research item unless it's already there (same type and title) or the family said it isn't for them. When
   * NotOnQ filled the gap itself (not Qloo behind it), the source line says so: "… · via NotOnQ".
   */
  add(type: ItemType, e: { id: string | null; name: string; year?: number | null; description?: string | null }, from: From): KitItem | null {
    if (this.avoid.has(nameKey(e.name))) return null;
    if (this.items.some((i) => i.type === type && nameKey(i.title) === nameKey(e.name))) return null;
    const n = (this.counts[type] = (this.counts[type] ?? 0) + 1);
    const filled = from.result?.servedBy === "notonq";
    const item: KitItem = {
      ref: `${REF_PREFIX[type]}${n}`,
      type,
      title: e.name,
      year: e.year ?? null,
      parts: filled ? [...from.parts.filter((p) => p !== "Qloo"), "via NotOnQ"] : from.parts,
      source: filled ? `${from.source} (filled by NotOnQ: Qloo had no entry)` : from.source,
      why: null,
      via: from.result?.via ?? null,
      entityId: e.id,
      ...(from.addedBy ? { addedBy: from.addedBy } : {}),
      ...(type === "place" ? { description: e.description ?? null } : {}),
    };
    this.items.push(item);
    return item;
  }

  /** A step's Qloo calls: counted for the budget, and summarised as which sources answered. */
  calls() {
    const logs: CallLog[] = [];
    const onCall: OnCall = (log) => {
      logs.push(log);
      if (log.cached) this.qlooCached++;
      else {
        this.qlooCalls++;
        this.sources[log.via]++;
        if (log.fellBack) this.sources.fellBack++;
      }
    };
    const summary = () => {
      const ok = logs.filter((l) => l.status === 200);
      const names = new Set(ok.map((l) => (l.servedBy === "notonq" ? "NotOnQ" : "Qloo")));
      return { sources: names.size ? [...names] : ["Qloo"], fellBack: logs.some((l) => l.fellBack) };
    };
    return { onCall, summary };
  }
}

function get(path: string, params: QlooParams, onCall: OnCall) {
  return qlooGet<unknown>(path, params, onCall);
}

type StepResult = { ok: boolean; summary: string; items: KitItem[]; sourceLine?: string };
type StepCopy = { title: string; running: string };

/** Runs one research step: its start and end events, its sources. A Qloo error ends the step, not the run. */
async function step(state: RunState, emit: Emit, id: string, tool: string, copy: StepCopy, work: (onCall: OnCall) => Promise<StepResult>): Promise<StepResult> {
  emit({ type: "step-start", id, tool, ...copy });
  const { onCall, summary } = state.calls();
  let result: StepResult;
  try {
    result = await work(onCall);
  } catch (error) {
    if (!(error instanceof QlooError)) throw error;
    console.error("qloo step failed", tool, error.message);
    result = { ok: false, summary: "Qloo didn’t answer in time, so the kit goes on without this.", items: [] };
  }
  const chips = result.items.map((i) => i.title);
  emit({ type: "step-end", id, ...result, chips, ...summary() });
  return result;
}

const list = (items: KitItem[], n = 3) => {
  const names = items.slice(0, n).map((i) => i.title);
  const rest = items.length - names.length;
  return rest > 0 ? `${names.join(", ")} and ${rest} more` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
};

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
  const era = eraFor(brief.birthYear, brief.years);
  const years = describeEra(era);
  const whose = possessive(brief.name);
  const who = brief.name ?? "they";

  // 1. The place, as Qloo knows it. Qloo's location signals take a place name; one it can't find gets the question
  // (or, skipped, the run goes on without a place).
  const typed = brief.answers?.nearbyPlace ?? brief.place;
  let placeLabel = typed;
  const found = await step(state, emit, "find-place", "find_place", { title: `Where ${who} grew up`, running: `Finding ${typed} on Qloo` }, async (onCall) => {
    const { data } = await get("/search", { query: typed, types: "urn:entity:locality", take: 5 }, onCall);
    const results = parseSearch(data);
    const match = pickByName(results, typed.split(",")[0]) ?? results[0];
    if (!match) return { ok: false, summary: `Qloo doesn’t know “${typed}” as a town or city.`, items: [], sourceLine: "places · Qloo" };
    placeLabel = localityLabel(match);
    return { ok: true, summary: `Qloo knows ${placeLabel}, so the songs, films and places can be the ones popular there.`, items: [], sourceLine: "locality · Qloo" };
  });
  const skipPlace = !found.ok && brief.answers?.skipPlace === true;
  if (!found.ok && !skipPlace) return ask(emit, ["nearbyPlace"], `Qloo knows little about ${typed} on its own. Which bigger town or city is nearby? We’ll carry on from there.`);
  // Qloo's location signal takes the place's name (verified with "Manchester", 25 Oct). Skipped: no place at all.
  const where = skipPlace ? undefined : typed;
  const town = skipPlace ? null : placeLabel.split(",")[0];
  if (skipPlace) placeLabel = typed;

  // 2. The era's music tags: Qloo files music by decade ("60s", "eighties").
  const decades: (Decade & { tag: { id: string; name: string } })[] = [];
  await step(state, emit, "era-tags", "era_tags", { title: `${whose} years: ${years}`, running: `Working out ${possessive(brief.name, true)} years` }, async (onCall) => {
    for (const d of era.decades) {
      const { data } = await get("/v2/tags", { "filter.query": d.short, "filter.tag.types": "urn:tag:genre:music", take: 15 }, onCall);
      const tag = pickDecadeTag(parseTags(data), d.start);
      if (tag) decades.push({ ...d, tag });
    }
    const named = decades.map((d) => `the ${d.short}`).join(" and ");
    const why = brief.years ? `The years you picked, ${years}` : `Born ${brief.birthYear}, so ages 15 to 25 fall in ${years}`;
    return decades.length
      ? { ok: true, summary: `${why}: ${named} (Qloo decade tags).`, items: [], sourceLine: `ages ${era.from - brief.birthYear}–${era.to - brief.birthYear} · decade tags · Qloo` }
      : { ok: false, summary: `Qloo has no decade tag for ${years}.`, items: [], sourceLine: "decade tags · Qloo" };
  });

  // 3. In parallel: the era's artists around the hometown, the family's likes, the films and TV of those years, and
  // the hometown's long-standing places.
  const [artists] = await Promise.all([
    step(state, emit, "era-artists", "era_artists", { title: `Songs ${who} may know`, running: `Finding songs${town ? ` from ${town}` : ""} in the ${decades.map((d) => d.short).join(" and ") || years}` }, (onCall) =>
      eraArtists(state, decades, where, town, onCall),
    ),
    brief.likes?.length ? step(state, emit, "likes", "likes", { title: "From what the family knows", running: "Looking up what the family told us" }, (onCall) => likes(state, brief.likes!, decades, onCall)) : null,
    step(state, emit, "era-films", "era_films", { title: "At the pictures", running: `Looking for films from ${years}` }, (onCall) => screen(state, "film", era, where, town, onCall)),
    step(state, emit, "era-tv", "era_tv", { title: "On the telly", running: `Looking for TV from ${years}` }, (onCall) => screen(state, "tv", era, where, town, onCall)),
    where && town
      ? step(state, emit, "era-places", "era_places", { title: "Places near home", running: `Looking for places near home in ${town}` }, (onCall) => places(state, where, town, onCall))
      : null,
  ]);

  // 4. Thin music: words from the family, else the question (or, skipped, carry on with what there is).
  let artistCount = state.items.filter((i) => i.type === "artist").length;
  if (artistCount < MIN_ARTISTS && brief.answers?.musicWords) {
    await step(state, emit, "music-words", "music_words", { title: "The music the family named", running: `Looking for “${brief.answers.musicWords}”` }, (onCall) =>
      musicWords(state, brief.answers!.musicWords!, decades, where, town, onCall),
    );
    artistCount = state.items.filter((i) => i.type === "artist").length;
  }
  const skippedMusic = brief.answers?.skipMusic === true && artistCount >= MIN_ARTISTS_SKIPPED;
  if (artistCount < MIN_ARTISTS && !skippedMusic) {
    return ask(
      emit,
      ["musicWords"],
      `Qloo found ${artists.items.length ? `only ${artistCount} artists` : "no artists"}${town ? ` for ${town}` : ""} in ${years}. What kind of music did ${who} love? A singer, a band or a style helps.`,
    );
  }
  if (abortSignal?.aborted) return;

  // 5. The kit: the curator picks the songs and orders them, picks a film, a TV show and a place to talk about, and
  // writes the prompts, all citing the research.
  emit({ type: "step-start", id: "curate", tool: "curate", title: `${whose} 20 minutes`, running: "Setting out the 20 minutes" });
  const { curated, model } = await curate(
    { place: placeLabel, era, name: brief.name, items: state.items, avoid: brief.avoid },
    abortSignal,
    () => emit({ type: "note", text: "The kit came back unreadable, so it’s set out once more." }),
  );
  const checked = checkCurated(curated, state.items);
  if (checked.problems.length) console.warn("curator problems", checked.problems);
  const picked = checked.items.filter((i) => i.why && i.type !== "song");
  emit({
    type: "step-end",
    id: "curate",
    ok: true,
    summary: `We set out ${setOut(checked.items.filter((i) => i.type === "song").length, picked)}: calm first, singalong last. Every item says where it came from.`,
    items: [],
    chips: [],
    sources: [],
    sourceLine: "songs · film · TV · place · prompts",
  });
  const items = await checkSongs(checked.items, emit);
  const known = new Set(items.map((i) => i.ref));
  const prompts = checked.prompts.filter((p) => p.refs.every((r) => known.has(r)));
  if (items.filter((i) => i.type === "song").length < MIN_SONGS) {
    emit({ type: "error", message: "The kit came back with too few songs. Try again in a minute." });
    return;
  }
  const kit: Kit = {
    id: newKitId(),
    brief: { name: brief.name, birthYear: brief.birthYear, place: brief.place, likes: brief.likes, avoid: brief.avoid, years: brief.years },
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

/** "5 songs, a film, a TV show and two places". */
function setOut(songs: number, picked: KitItem[]): string {
  const count = (t: ItemType) => picked.filter((i) => i.type === t).length;
  const words = ["", "a", "two", "three"];
  const parts = [`${songs} songs`];
  if (count("film")) parts.push(count("film") === 1 ? "a film" : `${words[count("film")] ?? count("film")} films`);
  if (count("tv")) parts.push(count("tv") === 1 ? "a TV show" : `${words[count("tv")] ?? count("tv")} TV shows`);
  if (count("place")) parts.push(count("place") === 1 ? "a place" : `${words[count("place")] ?? count("place")} places`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
}

function ask(emit: Emit, fields: AskField[], message: string) {
  emit({ type: "ask", fields, message });
}

const at = (town: string | null) => (town ? [town] : []);

/** The era's artists, decade by decade, popular around the place (decade tag + location signal). The bigger decade gets more. */
async function eraArtists(state: RunState, decades: (Decade & { tag: { id: string } })[], where: string | undefined, town: string | null, onCall: OnCall): Promise<StepResult> {
  const added: KitItem[] = [];
  for (const d of decades) {
    const r = await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.tags": d.tag.id, "signal.location.query": where, take: 12 }, onCall);
    const share = d.years >= 6 ? 8 : 6;
    for (const e of parseInsights(r.data).slice(0, share)) {
      const item = state.add("artist", e, { parts: [d.short, ...at(town), "Qloo"], source: `Qloo taste data: artists popular${town ? ` with people from ${town}` : ""} in the ${d.short}.`, result: r });
      if (item) added.push(item);
    }
  }
  const tags = decades.map((d) => d.short).join(" and ");
  return added.length
    ? { ok: true, summary: `On Qloo, people${town ? ` in ${town}` : ""} in the ${tags} over-index on ${list(added)}. We kept ${added.length} artists.`, items: added, sourceLine: [tags, ...at(town), "Qloo"].join(" · ") }
    : { ok: false, summary: `Qloo has no ${tags} artists${town ? ` for ${town}` : ""}.`, items: [], sourceLine: [tags, ...at(town), "Qloo"].join(" · ") };
}

/** What the family knows: an artist Qloo knows brings era artists like them; anything else is kept as the family said it. */
async function likes(state: RunState, names: string[], decades: { tag: { id: string }; short: string }[], onCall: OnCall): Promise<StepResult> {
  const added: KitItem[] = [];
  for (const name of names.slice(0, 3)) {
    const r = await get("/search", { query: name, types: "urn:entity:artist", take: 5 }, onCall);
    const match: QlooEntity | undefined = pickByName(parseSearch(r.data), name);
    if (!match) {
      const item = state.add("family", { id: null, name }, { parts: ["the family"], source: "Something the family told us.", addedBy: "family" });
      if (item) added.push(item);
      continue;
    }
    const own = state.add("artist", match, { parts: ["artist", "Qloo"], source: `The family named ${match.name}; Qloo knows them.`, result: r, addedBy: "family" });
    if (own) added.push(own);
    const decade = decades[0];
    const similar = await get("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": match.id, "filter.tags": decade?.tag.id, take: 6 }, onCall);
    for (const e of parseInsights(similar.data).slice(0, 3)) {
      const item = state.add("artist", e, {
        parts: [...(decade ? [decade.short] : []), `like ${match.name}`, "Qloo"],
        source: `Qloo taste data: ${decade ? `${decade.short} artists` : "artists"} liked by people who like ${match.name}.`,
        result: similar,
      });
      if (item) added.push(item);
    }
  }
  return {
    ok: added.length > 0,
    summary: added.length ? `From what the family told us: ${list(added)}.` : "Qloo had nothing on the family’s picks.",
    items: added,
    sourceLine: "the family · Qloo",
  };
}

/** Films or TV released in the era years, popular around the place. TV is thin by place, so it tries without the place too. */
async function screen(state: RunState, kind: "film" | "tv", era: Era, where: string | undefined, town: string | null, onCall: OnCall): Promise<StepResult> {
  const type = kind === "film" ? "urn:entity:movie" : "urn:entity:tv_show";
  const years = describeEra(era);
  const word = kind === "film" ? "film" : "TV";
  const base = { "filter.type": type, "filter.release_year.min": era.from, "filter.release_year.max": era.to, "filter.exclude.tags": NO_HORROR, take: kind === "film" ? 10 : 8 };
  const added: KitItem[] = [];
  const r = await get("/v2/insights", { ...base, "signal.location.query": where }, onCall);
  for (const e of parseInsights(r.data).slice(0, 6)) {
    const item = state.add(kind, e, { parts: [word, e.year ? String(e.year) : years, "Qloo"], source: `Qloo taste data: ${kind === "film" ? "films" : "TV"} from ${years}${town ? `, popular with people from ${town}` : ""}.`, result: r });
    if (item) added.push(item);
  }
  if (kind === "tv" && added.length < 3) {
    const wide = await get("/v2/insights", base, onCall);
    for (const e of parseInsights(wide.data).slice(0, 4 - added.length)) {
      const item = state.add("tv", e, { parts: ["TV", e.year ? String(e.year) : years, "Qloo"], source: `Qloo taste data: TV from ${years}.`, result: wide });
      if (item) added.push(item);
    }
  }
  const what = kind === "film" ? "films" : "TV shows";
  const sourceLine = `${word} · ${years} · Qloo`;
  return added.length
    ? { ok: true, summary: `Qloo’s ${what} from ${years}${town ? ` for ${town}` : ""} include ${list(added)}.`, items: added, sourceLine }
    : { ok: false, summary: `Qloo has no ${what} from ${years} here.`, items: [], sourceLine };
}

/** The family's words ("Irish ballads", "Elvis and rock'n'roll") as Qloo genres, then era artists in them near the place. */
async function musicWords(state: RunState, words: string, decades: { tag: { id: string }; short: string }[], where: string | undefined, town: string | null, onCall: OnCall): Promise<StepResult> {
  const t = await get("/v2/tags", { "filter.query": words, "filter.tag.types": "urn:tag:genre:music", "feature.semantic_search": true, take: 3 }, onCall);
  const genres = parseTags(t.data);
  if (!genres.length) return { ok: false, summary: `Qloo found no music matching “${words}”.`, items: [], sourceLine: "genres · Qloo" };
  const added: KitItem[] = [];
  const r = await get(
    "/v2/insights",
    { "filter.type": "urn:entity:artist", "signal.interests.tags": genres.map((g) => g.id).join(","), "filter.tags": decades[0]?.tag.id, "signal.location.query": where, take: 10 },
    onCall,
  );
  for (const e of parseInsights(r.data).slice(0, 8)) {
    const item = state.add("artist", e, {
      parts: [...(decades[0] ? [decades[0].short] : []), ...at(town), "Qloo"],
      source: `Qloo taste data: ${genres.map((g) => g.name).join(", ")}, from the family’s words “${words}”.`,
      result: r,
    });
    if (item) added.push(item);
  }
  return {
    ok: added.length > 0,
    summary: added.length ? `“${words}” is ${genres.map((g) => g.name).join(", ")} on Qloo: ${list(added)}.` : `No artists for “${words}”.`,
    items: added,
    sourceLine: [genres[0].name, ...at(town), "Qloo"].join(" · "),
  };
}

/**
 * Long-standing places in the hometown: Qloo's places are today's, so the run asks for the ones tagged historic (a
 * Victorian theatre, a 1930s library, a cricket ground), which were likely there in their youth too. They're in the
 * kit to talk about, not to visit.
 */
async function places(state: RunState, where: string, town: string, onCall: OnCall): Promise<StepResult> {
  const r = await get("/v2/insights", { "filter.type": "urn:entity:place", "filter.location.query": where, "filter.tags": "urn:tag:ambience:qloo:historic", take: 10 }, onCall);
  const added: KitItem[] = [];
  for (const e of parseInsights(r.data).slice(0, 8)) {
    const item = state.add("place", e, { parts: ["place", town, "Qloo"], source: `Qloo: a long-standing place in ${town}, still there today.`, result: r });
    if (item) added.push(item);
  }
  return added.length
    ? { ok: true, summary: `Qloo lists ${list(added)} in ${town}. They’re in the kit to talk about, not to visit.`, items: added, sourceLine: `places · ${town} · Qloo` }
    : { ok: false, summary: `Qloo has no long-standing places listed for ${town}.`, items: [], sourceLine: `places · ${town} · Qloo` };
}

/** While at least this many songs remain, titles MusicBrainz can't find are dropped; below it they stay, marked unchecked. */
const KEEP_SONGS = 4;

/**
 * Checks each song title the curator picked against MusicBrainz (one call a second). A confirmed song keeps the
 * curator's year (MusicBrainz's search ranks reissues and compilations, so its earliest match can be decades late) and
 * takes MusicBrainz's only when the curator gave none. A title it can't find is dropped (a made-up title must not reach
 * staff) unless that would leave fewer than KEEP_SONGS. If MusicBrainz can't be reached, songs stay, marked unchecked.
 * Offline: no calls.
 */
async function checkSongs(items: KitItem[], emit: Emit): Promise<KitItem[]> {
  const songs = items.filter((i) => i.type === "song");
  if (offline()) return items.map((i) => (i.type === "song" ? { ...i, check: "unchecked" as const } : i));
  emit({ type: "step-start", id: "check-songs", tool: "check_songs", title: "The song titles", running: "Checking each title on MusicBrainz" });
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
  const drop = new Set(songs.length - missing.length >= KEEP_SONGS ? missing.map((s) => s.ref) : []);
  const kept = items
    .filter((i) => !drop.has(i.ref))
    .map((i): KitItem => {
      if (i.type !== "song") return i;
      const found = results.get(i.ref) === "found";
      return {
        ...i,
        year: i.year ?? years.get(i.ref) ?? null,
        check: found ? "musicbrainz" : "unchecked",
        parts: found ? [...i.parts, "MusicBrainz"] : i.parts,
        source: found ? `AI pick, confirmed on MusicBrainz: a recording by ${i.by!.title} (${i.by!.ref})` : i.source,
      };
    });
  const confirmed = songs.filter((s) => results.get(s.ref) === "found").length;
  const dropped = [...drop].map((r) => songs.find((s) => s.ref === r)!.title);
  const unchecked = songs.length - confirmed - dropped.length;
  emit({
    type: "step-end",
    id: "check-songs",
    ok: confirmed > 0,
    summary: `${confirmed} of ${songs.length} titles are real recordings by those artists.${dropped.length ? ` Left out, not found: ${dropped.join(", ")}.` : ""}${unchecked ? ` ${unchecked} couldn’t be checked and say so.` : ""}`,
    items: [],
    chips: [],
    sources: ["MusicBrainz"],
    sourceLine: "song titles · MusicBrainz",
  });
  return kept;
}
