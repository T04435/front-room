import { z } from "zod";

/** The parts of Qloo's responses the app uses. Unknown fields are ignored and never leave the server. */

const entity = z.object({
  entity_id: z.string(),
  name: z.string(),
  popularity: z.number().optional(),
  disambiguation: z.string().nullable().optional(),
  properties: z
    .object({
      release_year: z.union([z.number(), z.string()]).nullable().optional(),
      short_description: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      image: z.object({ url: z.string().optional() }).partial().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
  query: z.object({ affinity: z.number().optional() }).partial().nullable().optional(),
  location: z.object({ lat: z.number().optional(), lon: z.number().optional() }).partial().nullable().optional(),
  tags: z.array(z.object({ id: z.string().optional(), tag_id: z.string().optional(), name: z.string().optional() }).passthrough()).nullable().optional(),
});

export type QlooEntity = {
  id: string;
  name: string;
  year: number | null;
  description: string | null;
  disambiguation: string | null;
  popularity: number | null;
  affinity: number | null;
  /** Qloo's picture of it (an artist photo, a film poster, a place), when there is one. */
  image: string | null;
  /** Genre tag names, lower case ("musical", "crime"): to keep films and TV gentle. */
  genres: string[];
  /** Place categories, lower case ("live music venue", "hotel"): to tell a venue from a hotel near it. */
  categories: string[];
  /** Films and TV: keyword tag names, lower case ("boxing"). Kept in memory only, to check against steer clear. */
  keywords: string[];
  /** Localities and places: where it is. */
  lat: number | null;
  lon: number | null;
};

const tagNames = (e: z.infer<typeof entity>, kind: string) => (e.tags ?? []).filter((t) => (t.id ?? t.tag_id ?? "").includes(kind) && t.name).map((t) => t.name!.toLowerCase());

function toEntity(e: z.infer<typeof entity>): QlooEntity {
  const year = Number(e.properties?.release_year);
  return {
    id: e.entity_id,
    name: e.name,
    year: Number.isFinite(year) && year > 0 ? year : null,
    description: e.properties?.short_description ?? e.properties?.description ?? null,
    disambiguation: e.disambiguation ?? null,
    popularity: e.popularity ?? null,
    affinity: e.query?.affinity ?? null,
    image: e.properties?.image?.url?.startsWith("https://") ? e.properties.image.url : null,
    lat: e.location?.lat ?? null,
    lon: e.location?.lon ?? null,
    genres: tagNames(e, ":genre:"),
    categories: tagNames(e, ":category:"),
    keywords: tagNames(e, ":keyword:"),
  };
}

function entities(list: unknown): QlooEntity[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  // Lists keyed by Qloo ids can repeat an entity: keep the first.
  return list.flatMap((x) => {
    const parsed = entity.safeParse(x);
    if (!parsed.success || seen.has(parsed.data.entity_id)) return [];
    seen.add(parsed.data.entity_id);
    return [toEntity(parsed.data)];
  });
}

/** /v2/insights for an entity type: `results.entities`. */
export function parseInsights(json: unknown): QlooEntity[] {
  return entities((json as { results?: { entities?: unknown } } | null)?.results?.entities);
}

/** /search: `results` is the list. */
export function parseSearch(json: unknown): QlooEntity[] {
  return entities((json as { results?: unknown } | null)?.results);
}

const tag = z.object({ id: z.string().optional(), tag_id: z.string().optional(), name: z.string().optional() });

/** /v2/tags: `results.tags`, ids under `id` or `tag_id`. */
export function parseTags(json: unknown): { id: string; name: string }[] {
  const list = (json as { results?: { tags?: unknown } } | null)?.results?.tags;
  if (!Array.isArray(list)) return [];
  return list.flatMap((x) => {
    const t = tag.safeParse(x);
    const id = t.success ? (t.data.id ?? t.data.tag_id) : undefined;
    return t.success && id && t.data.name ? [{ id, name: t.data.name }] : [];
  });
}

/** A locality from /search: "Manchester, United Kingdom". */
export function localityLabel(e: QlooEntity): string {
  return e.disambiguation ? `${e.name}, ${e.disambiguation.split(",").at(-1)?.trim()}` : e.name;
}

/** A name for comparing: lower case, no accents or punctuation, no leading "the". */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

/** The search result that is this name (exactly, or one containing the other, 5+ letters). Never just the top result. */
export function pickByName(results: QlooEntity[], name: string): QlooEntity | undefined {
  const want = nameKey(name);
  const exact = results.find((r) => nameKey(r.name) === want);
  if (exact) return exact;
  return results.find((r) => {
    const got = nameKey(r.name);
    const [short, long] = got.length < want.length ? [got, want] : [want, got];
    return short.length >= 5 && ` ${long} `.includes(` ${short} `);
  });
}
