import type { QlooParams, Result, Transport } from "@/lib/qloo-transport";

/**
 * Offline answers in Qloo's shapes (MUSIC_CARE_OFFLINE=1: unit tests and e2e), so test runs never spend the shared Qloo
 * key. Modelled on the live era probes of 25 Oct (decade tags plus a place, films by release year). Unknown places and
 * "Nowhere" give no results, to exercise the inline question.
 */
const e = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ entity_id: `fx-${id}`, name, popularity: 0.9, ...extra });

const ARTISTS_60S = ["The Beatles", "The Kinks", "The Who", "The Zombies", "Otis Redding", "The Hollies", "Herman's Hermits", "Dusty Springfield"];
const ARTISTS_70S = ["David Bowie", "T. Rex", "Slade", "Roxy Music", "Elton John", "ABBA", "The Carpenters", "10cc"];
const FILMS = [
  ["The Sound of Music", 1965],
  ["The Jungle Book", 1967],
  ["Who's Afraid of Virginia Woolf?", 1966],
  ["Oliver!", 1968],
  ["Mary Poppins", 1964],
  ["Butch Cassidy and the Sundance Kid", 1969],
] as const;
const TV = [
  ["Coronation Street", 1960],
  ["Top of the Pops", 1964],
  ["The Old Grey Whistle Test", 1971],
] as const;

function answer(path: string, p: QlooParams): unknown {
  const place = String(p["signal.location.query"] ?? "");
  if (/nowhere/i.test(place)) return { results: { entities: [] } };
  if (path === "/search") {
    const q = String(p.query ?? "");
    if (String(p.types).includes("locality")) return { results: /zzz/i.test(q) ? [] : [e(`loc-${q}`, q.replace(/,.*/, ""), { disambiguation: "England, United Kingdom" })] };
    return { results: [e(`art-${q}`, q)] };
  }
  if (path === "/v2/tags") {
    const q = String(p["filter.query"] ?? "");
    return { results: { tags: [{ id: `urn:tag:genre:music:${q}_rock`, name: `${q} Rock` }, { id: `urn:tag:genre:music:${q}`, name: q }] } };
  }
  const type = String(p["filter.type"]);
  if (type === "urn:entity:artist") {
    const tags = String(p["filter.tags"] ?? "");
    const names = tags.includes("70s") ? ARTISTS_70S : ARTISTS_60S;
    return { results: { entities: names.map((n) => e(`a-${n}`, n)) } };
  }
  if (type === "urn:entity:movie") return { results: { entities: FILMS.map(([n, y]) => e(`f-${n}`, n, { properties: { release_year: y } })) } };
  if (type === "urn:entity:tv_show") return { results: { entities: TV.map(([n, y]) => e(`t-${n}`, n, { properties: { release_year: y } })) } };
  return { results: { entities: [] } };
}

export const fixtureTransport: Transport = {
  async get<T>(path: string, params: QlooParams, onCall?: Parameters<Transport["get"]>[2]): Promise<Result<T>> {
    onCall?.({ path, params, ms: 1, cached: false, status: 200, via: "notonq", fellBack: false });
    return { data: answer(path, params) as T, via: "notonq" };
  },
};
