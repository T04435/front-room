import "server-only";
import type { Place } from "@/lib/person";
import { parseSearch, type QlooEntity } from "@/lib/qloo-parse";
import type { CallLog } from "@/lib/qloo-transport";
import { qlooGet } from "@/server/qloo";

/**
 * Where a place in the story really is, as Qloo knows it. Qloo reads a bare "Glasgow" as Glasgow, Kentucky (the live
 * results for a Glasgow woman were US top tens), so each place is pinned to a country before anything is looked up:
 * the country most of their places share, else the homes' country (the UK for the demo), else Qloo's first answer.
 */
export type Locality = {
  /** What Qloo is asked with: "Glasgow, United Kingdom". */
  query: string;
  /** "Glasgow City, Alba / Scotland, United Kingdom". */
  label: string;
  country: string;
  /** Scotland, England, Wales or Northern Ireland, for UK places. */
  nation: string | null;
  lat: number | null;
  lon: number | null;
};

/** The homes' country: places that could be anywhere ("Glasgow", "Manchester") are looked for here first. */
const HOME_COUNTRY = process.env.FRONT_ROOM_COUNTRY || "United Kingdom";
const NATIONS = ["Scotland", "England", "Wales", "Northern Ireland"];

const countryOf = (e: QlooEntity) => e.disambiguation?.split(",").at(-1)?.trim() ?? "";
const nationOf = (e: QlooEntity) => NATIONS.find((n) => e.disambiguation?.includes(n)) ?? null;

function toLocality(name: string, e: QlooEntity): Locality {
  const country = countryOf(e);
  return { query: country ? `${name}, ${country}` : name, label: e.disambiguation ?? name, country, nation: nationOf(e), lat: e.lat, lon: e.lon };
}

const search = (query: string, onCall: (log: CallLog) => void) =>
  qlooGet<unknown>("/search", { query, types: "urn:entity:locality", take: 6 }, onCall)
    .then((r) => parseSearch(r.data))
    .catch(() => [] as QlooEntity[]);

/** Each place's locality (null when Qloo doesn't know it: the place's own name is used as typed). */
export async function resolvePlaces(places: Place[], onCall: (log: CallLog) => void): Promise<Map<string, Locality | null>> {
  const found = await Promise.all(places.map((pl) => search(pl.name, onCall)));
  // The country most of their places share (two or more agree), else the homes' country.
  const votes = new Map<string, number>();
  for (const list of found) if (list[0]) votes.set(countryOf(list[0]), (votes.get(countryOf(list[0])) ?? 0) + 1);
  const [top, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const hint = n >= 2 ? top : HOME_COUNTRY;
  const out = new Map<string, Locality | null>();
  await Promise.all(
    places.map(async (pl, i) => {
      const list = found[i];
      const inHint = list.find((e) => countryOf(e) === hint);
      if (inHint) return out.set(pl.id, toLocality(pl.name, inHint));
      // "Glasgow" alone is six US towns: ask again with the country.
      const again = (await search(`${pl.name}, ${hint}`, onCall)).find((e) => countryOf(e) === hint);
      if (again) return out.set(pl.id, toLocality(pl.name, again));
      out.set(pl.id, list[0] ? toLocality(pl.name, list[0]) : null);
    }),
  );
  return out;
}

/** Kilometres between two localities (null when either has no coordinates). */
export function kmBetween(a: Locality | null | undefined, b: Locality | null | undefined): number | null {
  if (a?.lat == null || a.lon == null || b?.lat == null || b.lon == null) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The country in English, as Qloo's `filter.release_country` wants it ("Spain"; "ES" returns nothing). */
const ENGLISH: Record<string, string> = { España: "Spain", Italia: "Italy", México: "Mexico", Deutschland: "Germany", Polska: "Poland", Éire: "Ireland", "Bhārat": "India" };
export const countryName = (l: Locality | null | undefined) => (l?.country ? (ENGLISH[l.country] ?? l.country) : null);

/**
 * Where the era's global hits were the local ones too (F3): English-language countries. Anywhere else, a place's own
 * music comes first and a thin answer means fewer cards, never Anglo hits to fill.
 */
export const globalIsLocal = (l: Locality | null | undefined) => !l?.country || ["United Kingdom", "Ireland", "United States", "Australia", "Canada", "New Zealand"].includes(countryName(l)!);

/** Places this close are one town for research (Govan is in Glasgow): one look-up, not two. */
export const SAME_TOWN_KM = 12;

/**
 * Qloo's music tags for where a place is, most local first, and the word for them: Glasgow → Scottish, then British.
 * Qloo's decade tags rarely combine with the most local ones, so the wider one is the fallback before "anywhere".
 */
export function localTags(l: Locality | null | undefined): { tag: string; word: string }[] {
  if (!l) return [];
  const t = (tag: string, word: string) => ({ tag: `urn:tag:genre:music:${tag}`, word });
  const label = l.label;
  switch (l.country) {
    case "United Kingdom":
      return [...(l.nation === "Scotland" ? [t("scottish", "Scottish")] : l.nation === "Wales" ? [t("welsh", "Welsh")] : l.nation === "Northern Ireland" ? [t("irish", "Irish")] : []), t("british", "British")];
    case "Ireland":
      return [t("irish", "Irish")];
    case "India":
      return /Punjab/.test(label) ? [t("punjabi", "Punjabi"), t("bollywood", "Bollywood")] : [t("bollywood", "Bollywood"), t("indian", "Indian")];
    case "Pakistan":
      return [t("punjabi", "Punjabi"), t("pakistani", "Pakistani")];
    case "Cuba":
      return [t("cuban", "Cuban"), t("latin", "Latin")];
    case "España":
    case "Spain":
      // All three are real Qloo tags (probed 31 Oct): copla and flamenco reach the 50s–70s that "spanish" alone misses.
      return [t("spanish", "Spanish"), t("copla", "copla"), t("flamenco", "flamenco")];
    case "México":
    case "Mexico":
      return [t("mexican", "Mexican"), t("latin", "Latin")];
    case "Jamaica":
      return [t("jamaican", "Jamaican"), t("reggae", "reggae")];
    case "Italia":
    case "Italy":
      return [t("italian", "Italian")];
    case "France":
      return [t("french", "French")];
    default:
      return [];
  }
}
