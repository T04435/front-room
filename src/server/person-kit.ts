import "server-only";
import { eraFor, pickDecadeTag } from "@/lib/era";
import { REF_PREFIX, searchLinks, SONG_MINUTES, type Kit, type KitItem, type Phase } from "@/lib/kit";
import { itemKey, itemStats, type Goal, type ItemStat, type Logged } from "@/lib/learning";
import { birthYearOf, eraForPlace, steersClear, type Person } from "@/lib/person";
import { nameKey, parseInsights, parseSearch, parseTags, pickByName } from "@/lib/qloo-parse";
import type { CallLog } from "@/lib/qloo-transport";
import { offline } from "@/server/env";
import { MODELS } from "@/server/models";
import { checkSong } from "@/server/musicbrainz";
import { promptsFor } from "@/server/prompts";
import { QlooError, qlooGet } from "@/server/qloo";
import { pickSongs } from "@/server/songs";

/** About 7 known items (proven or the family's yes) plus 3 new tries a kit; Settle keeps to what's known, with 1. */
const KNOWN = 7;
const NEW_TRIES: Record<Goal, number> = { settle: 1, chat: 3, sing: 3 };

type Cand = Omit<KitItem, "ref"> & { stat?: ItemStat };

/**
 * A person's next kit (v2 brief, P0 5). Known items: proven ones first, then what the family said yes to (in the
 * story or on Ring a bell?), then era matches; never paused, resting or steer-clear items. Shaped by goal: Settle is
 * proven and calm, Chat mixes in a film, the telly and a place, Sing builds to a singalong. Plus new tries from Qloo,
 * seeded by what's proven, in their place and decade ("New try · like Waterloo, 70s, Manchester").
 */
export async function buildPersonKit(person: Person, kits: Kit[], logs: Logged[], goal: Goal, onCall: (log: CallLog) => void, abortSignal?: AbortSignal): Promise<Kit> {
  const by = birthYearOf(person)!;
  const home = person.places[0];
  const range = eraForPlace(home, by);
  const era = eraFor(by, [range.from, range.to]);
  const stats = itemStats(kits, logs, person.resolvedUpsets);
  const blocked = (key: string) => ["paused", "resting"].includes(stats.get(key)?.state ?? "");

  // 1. Every known candidate, newest version of each.
  const cands = new Map<string, Cand>();
  const add = (c: Cand) => {
    const key = c.key ?? itemKey(c);
    if (cands.has(key) || blocked(key) || steersClear(person, c.title, c.by?.title)) return;
    cands.set(key, { ...c, key, stat: stats.get(key) });
  };
  for (const kit of [...kits].reverse()) {
    for (const i of kit.items) {
      const s = stats.get(i.key ?? itemKey(i));
      if (s?.state === "proven" && (i.type === "song" || i.why)) add({ ...i, reason: "proven", why: s.label, like: undefined });
    }
  }
  // A Ring a bell? yes keeps its card's source line ("70s · Blackpool · Qloo").
  const cardParts = new Map(Object.values(person.suggestions).flat().map((c) => [nameKey(c.title), c.parts]));
  for (const l of person.loves) {
    const parts = cardParts.get(nameKey(l.title));
    if (l.type === "song" && l.by) add(songItem(l.title, l.by, l.year ?? null, "family_yes", l.source === "ring_a_bell" ? "They rang a bell" : "The family said they loved it", parts));
    if (l.type === "film" || l.type === "tv" || l.type === "place") add(pick(l.type, l.title, l.year ?? null, "family_yes", l.source === "ring_a_bell" ? "They rang a bell" : "From the family", parts));
  }
  // Tried before (not proven): back in if there's room, as era matches.
  for (const kit of [...kits].reverse()) for (const i of kit.items) if (i.type === "song" || i.why) add({ ...i, reason: "era_match", why: stats.get(i.key ?? itemKey(i))?.label ?? "Tried before", like: undefined });
  // Ring a bell? cards nobody said no to.
  for (const cards of Object.values(person.suggestions)) {
    for (const c of cards) {
      if (c.answer === "upset" || c.answer === "yes") continue;
      if (c.type === "song" && c.by) add(songItem(c.title, c.by, c.year, "era_match", "Matches their era and place", c.parts));
      if (c.type === "film" || c.type === "tv" || c.type === "place") add(pick(c.type, c.title, c.year, "era_match", "Matches their era and place", c.parts));
    }
  }

  // 2. Choose by goal.
  const all = [...cands.values()];
  const rank = (c: Cand) => (c.reason === "proven" ? 0 : c.reason === "family_yes" ? 1 : 2) * 100 - (c.stat?.sangSessions ?? 0) * 3 - (c.stat?.engagedSessions ?? 0) * 2 - (c.stat?.calmSessions ?? 0);
  const songs = all.filter((c) => c.type === "song").sort((a, b) => rank(a) - rank(b));
  const screen = all.filter((c) => c.type === "film" || c.type === "tv").sort((a, b) => rank(a) - rank(b));
  const places = all.filter((c) => c.type === "place").sort((a, b) => rank(a) - rank(b));
  let chosen: Cand[];
  if (goal === "settle") {
    const calm = songs.filter((s) => (s.stat?.calmSessions ?? 0) > 0 || s.reason !== "era_match");
    chosen = (calm.length >= 3 ? calm : songs).slice(0, 5);
  } else if (goal === "sing") {
    chosen = songs.slice(0, 6);
  } else {
    chosen = [...songs.slice(0, 4), ...[screen.find((s) => s.type === "film"), screen.find((s) => s.type === "tv")].filter((x): x is Cand => Boolean(x)), ...places.slice(0, 1)];
  }
  chosen = chosen.slice(0, KNOWN);

  // 3. New tries from Qloo, seeded by what's proven (else the family's loves), in their place and decade.
  const tries = await newTries(person, chosen, stats, era, home.name, NEW_TRIES[goal], onCall, abortSignal).catch((e) => {
    console.error("new tries failed", e instanceof Error ? e.message : e);
    return [] as Cand[];
  });

  // 4. Order: Settle stays calm; Chat goes calm → familiar → singalong; Sing builds to its biggest singalong last.
  const songsIn = [...chosen.filter((c) => c.type === "song"), ...tries];
  const ordered = orderSongs(songsIn, goal);
  const counters: Partial<Record<KitItem["type"], number>> = {};
  const ref = (t: KitItem["type"]) => `${REF_PREFIX[t]}${(counters[t] = (counters[t] ?? 0) + 1)}`;
  const items: KitItem[] = [...ordered, ...chosen.filter((c) => c.type !== "song")].map(({ stat, ...c }) => {
    void stat;
    return { ...c, ref: ref(c.type) };
  });

  const { prompts, summary } = await promptsFor(person, items, goal, abortSignal);
  return {
    id: "",
    brief: { name: person.preferredName, birthYear: by, place: home.name },
    place: home.label ?? home.name,
    era,
    items,
    prompts,
    summary,
    sources: { notonq: 0, qloo: 0, fellBack: 0 },
    model: offline() ? "offline" : MODELS.curator,
    createdAt: new Date().toISOString(),
    personId: person.id,
    goal,
  };
}

function songItem(title: string, by: string, year: number | null, reason: KitItem["reason"], why: string, parts?: string[]): Cand {
  return {
    type: "song",
    title,
    year,
    by: { ref: "", title: by },
    parts: parts ?? ["song", "the family"],
    source: why,
    why,
    via: null,
    entityId: null,
    reason,
    links: searchLinks(by, title),
    minutes: SONG_MINUTES,
    key: itemKey({ type: "song", title, by }),
  };
}

function pick(type: "film" | "tv" | "place", title: string, year: number | null, reason: KitItem["reason"], why: string, parts?: string[]): Cand {
  return { type, title, year, parts: parts ?? [type, "the family"], source: why, why, via: null, entityId: null, reason, key: itemKey({ type, title }) };
}

function orderSongs(songs: Cand[], goal: Goal): Cand[] {
  const sang = (c: Cand) => c.stat?.sangSessions ?? 0;
  const calm = (c: Cand) => c.stat?.calmSessions ?? 0;
  const withPhase = (c: Cand, phase: Phase): Cand => ({ ...c, phase });
  if (goal === "settle") return [...songs].sort((a, b) => calm(b) - calm(a)).map((c) => withPhase(c, "calm"));
  if (goal === "sing") {
    const s = [...songs].sort((a, b) => sang(a) - sang(b));
    return s.map((c, i) => withPhase(c, i >= s.length - 2 ? "singalong" : i === 0 ? "calm" : "familiar"));
  }
  const byCalm = [...songs].sort((a, b) => calm(b) - calm(a) || sang(a) - sang(b));
  const first = byCalm.slice(0, 2).map((c) => withPhase(c, "calm"));
  const rest = byCalm.slice(2).sort((a, b) => sang(a) - sang(b));
  return [...first, ...rest.map((c, i) => withPhase(c, i >= rest.length - 2 ? "singalong" : "familiar"))];
}

async function newTries(person: Person, chosen: Cand[], stats: Map<string, ItemStat>, era: ReturnType<typeof eraFor>, where: string, n: number, onCall: (log: CallLog) => void, abortSignal?: AbortSignal): Promise<Cand[]> {
  if (n <= 0) return [];
  // Seeds: the proven songs' artists (best first), else the family's loves.
  const proven = [...stats.values()].filter((s) => s.state === "proven" && s.type === "song" && s.by).sort((a, b) => b.sangSessions + b.engagedSessions - (a.sangSessions + a.engagedSessions));
  const seeds = proven.length
    ? proven.slice(0, 2).map((s) => ({ name: s.by!, like: s.title }))
    : person.loves.filter((l) => l.type === "artist" || (l.type === "song" && l.by)).slice(0, 2).map((l) => ({ name: l.by ?? l.title, like: l.title }));
  if (!seeds.length) return [];
  const known = new Set([...chosen.map((c) => nameKey(c.by?.title ?? c.title)), ...[...stats.values()].map((s) => nameKey(s.by ?? s.title))]);
  const lead = era.decades[0];
  let tag: string | undefined;
  try {
    const { data } = await qlooGet("/v2/tags", { "filter.query": lead.short, "filter.tag.types": "urn:tag:genre:music", take: 15 }, onCall);
    tag = pickDecadeTag(parseTags(data), lead.start)?.id;
  } catch (e) {
    if (!(e instanceof QlooError)) throw e;
  }
  const artists: { name: string; like: string }[] = [];
  for (const seed of seeds) {
    try {
      const s = await qlooGet("/search", { query: seed.name, types: "urn:entity:artist", take: 5 }, onCall);
      const match = pickByName(parseSearch(s.data), seed.name);
      if (!match) continue;
      const r = await qlooGet("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": match.id, "filter.tags": tag, "signal.location.query": where, take: 8 }, onCall);
      for (const e of parseInsights(r.data)) {
        if (known.has(nameKey(e.name)) || steersClear(person, e.name) || artists.some((a) => nameKey(a.name) === nameKey(e.name))) continue;
        artists.push({ name: e.name, like: seed.like });
        if (artists.length >= n + 2) break;
      }
    } catch (e) {
      if (!(e instanceof QlooError)) throw e;
    }
  }
  const picks = await pickSongs(artists.map((a, i) => ({ ref: `t${i}`, artist: a.name, from: era.from, to: era.to, place: where })), abortSignal);
  const out: Cand[] = [];
  for (const p of picks) {
    if (out.length >= n) break;
    const a = artists[Number(p.ref.slice(1))];
    if (!offline() && !(await checkSong(a.name, p.title).then((r) => r.found).catch(() => false))) continue;
    const like = `${a.like}, ${lead.short}, ${where}`;
    const c = songItem(p.title, a.name, p.year, "new_try", `New try · like ${like}`, [lead.short, `like ${a.like}`, where, "Qloo"]);
    out.push({ ...c, like, check: offline() ? "unchecked" : "musicbrainz" });
  }
  return out;
}
