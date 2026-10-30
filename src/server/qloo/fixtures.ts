import type { QlooParams, Result, Transport } from "@/lib/qloo-transport";

/**
 * Offline answers in Qloo's shapes (FRONT_ROOM_OFFLINE=1: unit tests and e2e), so test runs never spend the shared Qloo
 * key. Modelled on the live era probes of 25 Oct (decade tags plus a place, films by release year). Unknown places and
 * "Nowhere" give no results, to exercise the inline question.
 */
const e = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ entity_id: `fx-${id}`, name, popularity: 0.9, ...extra });

const ARTISTS_50S = ["Elvis Presley", "Buddy Holly", "Lonnie Donegan", "Cliff Richard", "Frank Sinatra", "Doris Day", "Bill Haley & His Comets", "Connie Francis"];
const ARTISTS_60S = ["The Beatles", "The Kinks", "The Who", "The Zombies", "Otis Redding", "The Hollies", "Herman's Hermits", "Dusty Springfield"];
const ARTISTS_70S = ["David Bowie", "T. Rex", "Slade", "Roxy Music", "Elton John", "ABBA", "The Carpenters", "10cc"];
const ARTISTS_80S = ["Madonna", "Duran Duran", "Whitney Houston", "Wham!", "Culture Club", "Michael Jackson", "Kate Bush", "Dire Straits"];
// Outside the UK (F7): what NotOnQ's era fill and Qloo's release-country filter gave in the live probes of 31 Oct, so
// the Rosa and Amrit examples show the same shape offline as live.
const ARTISTS_SPANISH = ["Raphael", "Marisol", "Julio Iglesias", "Mocedades", "Paco de Lucía", "Camarón de la Isla", "Camilo Sesto", "Rocío Dúrcal"];
const ARTISTS_PUNJABI = ["Mohammed Rafi", "Lata Mangeshkar", "Asha Bhosle", "Kishore Kumar", "Surinder Kaur", "Noor Jehan", "Mukesh", "Manna Dey"];
const BY_COUNTRY: Record<string, { films: [string, number, string][]; tv: [string, number][] }> = {
  Spain: {
    films: [
      ["Bienvenido, Mister Marshall", 1953, "Spain"],
      ["Marcelino pan y vino", 1955, "Spain"],
      ["Viridiana", 1961, "Spain"],
      ["La gran familia", 1962, "Spain"],
      ["El verdugo", 1963, "Spain"],
      ["The Good, the Bad and the Ugly", 1966, "Italy"],
    ],
    tv: [
      ["Mi hijo y yo", 1963],
      ["Estudio 1", 1965],
      ["La familia Colón", 1965],
      ["Habitación 508", 1966],
    ],
  },
  India: {
    films: [
      ["Pyaasa", 1957, "India"],
      ["Mother India", 1957, "India"],
      ["Mughal-e-Azam", 1960, "India"],
      ["Sangam", 1964, "India"],
      ["Guide", 1965, "India"],
    ],
    tv: [],
  },
};
/** Where each town is, as Qloo's locality search labels it; else the country the query names; else England. */
const TOWNS: Record<string, string> = {
  sevilla: "Andalucía, España",
  seville: "Andalucía, España",
  madrid: "Comunidad de Madrid, España",
  amritsar: "Punjab, India",
  lahore: "Punjab, Pakistan",
  bradford: "England, United Kingdom",
  glasgow: "Scotland, United Kingdom",
  govan: "Scotland, United Kingdom",
  cardiff: "Wales, United Kingdom",
};
const localityLabel = (q: string) => TOWNS[q.replace(/,.*/, "").trim().toLowerCase()] ?? (q.includes(",") ? q.split(",").at(-1)!.trim() : "England, United Kingdom");

const FILMS = [
  ["Singin' in the Rain", 1952],
  ["Rebel Without a Cause", 1955],
  ["Some Like It Hot", 1959],
  ["Breakfast at Tiffany's", 1961],
  ["Mary Poppins", 1964],
  ["The Sound of Music", 1965],
  ["Who's Afraid of Virginia Woolf?", 1966],
  ["The Jungle Book", 1967],
  ["Oliver!", 1968],
  ["Butch Cassidy and the Sundance Kid", 1969],
  ["The Godfather", 1972],
  ["Star Wars", 1977],
  ["Grease", 1978],
  ["E.T. the Extra-Terrestrial", 1982],
  ["Back to the Future", 1985],
] as const;
const TV = [
  ["Hancock's Half Hour", 1956],
  ["Coronation Street", 1960],
  ["Doctor Who", 1963],
  ["Top of the Pops", 1964],
  ["Dad's Army", 1968],
  ["The Old Grey Whistle Test", 1971],
  ["Fawlty Towers", 1975],
  ["Only Fools and Horses", 1981],
  ["EastEnders", 1985],
] as const;

const PLACES: Record<string, [name: string, description: string][]> = {
  manchester: [
    ["Palace Theatre Manchester", "Grand Victorian auditorium in central Manchester"],
    ["Manchester Central Library", "Monumental 1930s neoclassical city library"],
    ["Old Trafford Cricket Ground", "Historic Test-match cricket venue"],
  ],
  liverpool: [
    ["The Cavern Club", "The cellar club where the Merseybeat bands played"],
    ["Royal Liver Building", "Waterfront landmark with the Liver Birds"],
    ["Liverpool Empire Theatre", "Variety and concert theatre on Lime Street"],
  ],
  blackpool: [
    ["The Blackpool Tower", "Victorian tower with its famous ballroom"],
    ["Blackpool Pleasure Beach", "Seafront amusement park"],
    ["Winter Gardens Blackpool", "Ballrooms, theatres and conference halls"],
  ],
  leeds: [
    ["Leeds Grand Theatre", "Victorian theatre and opera house"],
    ["Kirkgate Market", "One of Europe's largest covered markets"],
    ["Roundhay Park", "Large park with lakes and gardens"],
  ],
  london: [
    ["Royal Albert Hall", "Victorian concert hall in Kensington"],
    ["London Palladium", "West End variety theatre"],
    ["Kew Gardens", "Botanic gardens by the Thames"],
  ],
  sevilla: [
    ["La Giralda", "The cathedral's bell tower"],
    ["Torre del Oro", "Thirteenth-century tower on the Guadalquivir"],
    ["Plaza de España", "The 1929 exposition square in María Luisa Park"],
  ],
  madrid: [
    ["Teatro Real", "The opera house facing the Royal Palace"],
    ["Parque del Retiro", "The great park with its boating lake"],
  ],
  amritsar: [
    ["Golden Temple", "Harmandir Sahib, the holiest gurdwara of Sikhism"],
    ["Jallianwala Bagh", "Memorial garden near the Golden Temple"],
  ],
  bradford: [
    ["Alhambra Theatre", "Edwardian theatre with its domed tower"],
    ["Cartwright Hall", "Art gallery in Lister Park"],
  ],
  glasgow: [
    ["Barrowland Ballroom", "East End dance hall and concert venue"],
    ["Kelvingrove Art Gallery and Museum", "Red sandstone museum in the West End"],
    ["The Barras", "Weekend street market in the East End"],
  ],
};
const placesFor = (query: string) => {
  const town = query.replace(/,.*/, "").trim();
  return PLACES[town.toLowerCase()] ?? [[`${town} Town Hall`, `The town hall in ${town}`], [`${town} Market`, `The market in ${town}`]];
};

/** Genre tags as Qloo gives them, so the gentle-first rule shows offline. */
const GENRES: Record<string, string[]> = {
  "Singin' in the Rain": ["musical", "comedy"],
  "Rebel Without a Cause": ["drama"],
  "Some Like It Hot": ["comedy", "romance"],
  "Breakfast at Tiffany's": ["romance", "comedy"],
  "Mary Poppins": ["musical", "family"],
  "The Sound of Music": ["musical", "family"],
  "Who's Afraid of Virginia Woolf?": ["drama"],
  "The Jungle Book": ["animation", "family", "musical"],
  "Oliver!": ["musical", "family"],
  "Butch Cassidy and the Sundance Kid": ["western", "crime"],
  "The Godfather": ["crime", "drama"],
  "Star Wars": ["science fiction", "action", "war"],
  Grease: ["musical", "romance"],
  "E.T. the Extra-Terrestrial": ["family", "science fiction"],
  "Back to the Future": ["comedy", "science fiction"],
  "Hancock's Half Hour": ["comedy"],
  "Coronation Street": ["soap opera", "drama"],
  "Doctor Who": ["science fiction"],
  "Top of the Pops": ["music", "variety"],
  "Dad's Army": ["comedy", "war"],
  "The Old Grey Whistle Test": ["music"],
  "Fawlty Towers": ["comedy"],
  "Only Fools and Horses": ["comedy"],
  EastEnders: ["soap opera", "drama"],
};
/** How familiar each is (Qloo's popularity), so the familiar films lead offline too (IM-4). */
const POPULAR: Record<string, number> = { "The Sound of Music": 0.99, "Mary Poppins": 0.98, Grease: 0.97, "Star Wars": 0.99, "The Jungle Book": 0.96, "Oliver!": 0.9, "Breakfast at Tiffany's": 0.93, "Who's Afraid of Virginia Woolf?": 0.7, "Butch Cassidy and the Sundance Kid": 0.85 };
/** When a show's run ended (IM-3). Coronation Street is still on: this year stands for that offline. */
const FINALE: Record<string, number> = { "Coronation Street": new Date().getFullYear(), "Doctor Who": 1989, "Top of the Pops": 2006, "Fawlty Towers": 1979, "Dad's Army": 1977, "Hancock's Half Hour": 1961, "The Old Grey Whistle Test": 1987, "Only Fools and Horses": 2003, EastEnders: new Date().getFullYear() };
const genreTags = (n: string) => ({ tags: (GENRES[n] ?? []).map((g) => ({ id: `urn:tag:genre:media:${g.replace(/\s+/g, "_")}`, name: g })) });

/** Films or TV in the release years asked for (all of them if none fall there, as Qloo leans popular). */
function inYears(list: readonly (readonly [string, number])[], p: QlooParams) {
  const min = Number(p["filter.release_year.min"] ?? 0);
  const max = Number(p["filter.release_year.max"] ?? 9999);
  const hit = list.filter(([, y]) => y >= min && y <= max);
  return hit.length ? hit : list;
}

function answer(path: string, p: QlooParams): unknown {
  const place = String(p["signal.location.query"] ?? "");
  if (/nowhere/i.test(place)) return { results: { entities: [] } };
  if (path === "/search") {
    const q = String(p.query ?? "");
    if (String(p.types).includes("locality")) return { results: /zzz/i.test(q) ? [] : [e(`loc-${q}`, q.replace(/,.*/, ""), { disambiguation: localityLabel(q) })] };
    // A venue the story names ("Barrowland Glasgow") is a music venue, as Qloo tags the real ones.
    // A title Qloo doesn't know (IM-5's stand-ins): nothing found.
    if (/\b(unknown|zzz)\b/i.test(q)) return { results: [] };
    if (String(p.types).includes("urn:entity:place")) return { results: [e(`p-${q}`, q, { tags: [{ id: "urn:tag:category:place:music_venue", name: "Music venue" }] })] };
    return { results: [e(`art-${q}`, q)] };
  }
  if (path === "/v2/tags") {
    const q = String(p["filter.query"] ?? "");
    return { results: { tags: [{ id: `urn:tag:genre:music:${q}_rock`, name: `${q} Rock` }, { id: `urn:tag:genre:music:${q}`, name: q }] } };
  }
  const type = String(p["filter.type"]);
  // A country filter: that country's own films and TV, or nothing (never the Hollywood list).
  const country = p["filter.release_country"] ? String(p["filter.release_country"]) : null;
  if (country && (type === "urn:entity:movie" || type === "urn:entity:tv_show")) {
    const set = BY_COUNTRY[country];
    if (!set) return { results: { entities: [] } };
    const list = type === "urn:entity:movie" ? set.films : set.tv.map(([n, y]) => [n, y, country] as [string, number, string]);
    const min = Number(p["filter.release_year.min"] ?? 0);
    const max = Number(p["filter.release_year.max"] ?? 9999);
    return { results: { entities: list.filter(([, y]) => y >= min && y <= max).map(([n, y, c]) => e(`c-${n}`, n, { properties: { release_year: y, release_country: [c, country] }, ...(n.includes("Ugly") ? { tags: [{ id: "urn:tag:genre:media:western", name: "western" }] } : {}) })) } };
  }
  if (type === "urn:entity:artist") {
    const tags = String(p["filter.tags"] ?? "");
    if (/spanish|copla|flamenco/.test(tags)) return { results: { entities: ARTISTS_SPANISH.map((n) => e(`a-${n}`, n)) } };
    if (/punjabi|bollywood|indian|pakistani/.test(tags)) return { results: { entities: ARTISTS_PUNJABI.map((n) => e(`a-${n}`, n)) } };
    const names = tags.includes("80s") ? ARTISTS_80S : tags.includes("70s") ? ARTISTS_70S : tags.includes("50s") ? ARTISTS_50S : ARTISTS_60S;
    return { results: { entities: names.map((n) => e(`a-${n}`, n)) } };
  }
  if (type === "urn:entity:movie") return { results: { entities: inYears(FILMS, p).map(([n, y]) => e(`f-${n}`, n, { properties: { release_year: y }, ...genreTags(n), ...(POPULAR[n] ? { popularity: POPULAR[n] } : {}) })) } };
  if (type === "urn:entity:place") return { results: { entities: placesFor(String(p["filter.location.query"] ?? "Manchester")).map(([n, d]) => e(`p-${n}`, n, { properties: { description: d } })) } };
  if (type === "urn:entity:tv_show") return { results: { entities: inYears(TV, p).map(([n, y]) => e(`t-${n}`, n, { properties: { release_year: y, ...(FINALE[n] ? { finale_year: FINALE[n] } : {}) }, ...genreTags(n) })) } };
  return { results: { entities: [] } };
}

export const fixtureTransport: Transport = {
  async get<T>(path: string, params: QlooParams, onCall?: Parameters<Transport["get"]>[2]): Promise<Result<T>> {
    onCall?.({ path, params, ms: 1, cached: false, status: 200, via: "notonq", fellBack: false, servedBy: "qloo" });
    return { data: answer(path, params) as T, via: "notonq", servedBy: "qloo" };
  },
};
