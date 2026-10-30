import { momentSteered, type Person } from "./person";
import { nameKey } from "./qloo-parse";

/**
 * What a card says to the carer: a hook tied to the person, and one open prompt (never testing, never the word
 * "remember"), with what they might answer. Written here from the item and the story, so it costs nothing and never
 * guesses: a hook only states what we know (the year, their age then, the place).
 */
export type Prompt = { ask: string; might: string };

const SONG_PROMPTS: Prompt[] = [
  { ask: "Did you ever dance to this? Where was it playing?", might: "A dance hall, a wedding, the radio at home, a name." },
  { ask: "Who did you listen to this with?", might: "A friend, a sister, a sweetheart, the people at work." },
  { ask: "Can you hum the start of this one?", might: "A hum, a line, a laugh, or just tapping along." },
  { ask: "Where were you when this was on the radio?", might: "Home, work, a café, the car, a kitchen." },
];
// A13: films, telly and places get more than one prompt too, and a football ground gets its own.
const FILM_PROMPTS: Prompt[] = [
  { ask: "Did you see this at the pictures? Who did you go with?", might: "A friend or a sweetheart, the cinema's name, a favourite song from it." },
  { ask: "Who was your favourite in this one?", might: "A star's name, a character, a song from it." },
  { ask: "What was the cinema like back then?", might: "The queue, the usherette, the seats, the price of a ticket." },
];
const TV_PROMPTS: Prompt[] = [
  { ask: "Did you watch this at home? Who watched it with you?", might: "Family round the set, a favourite character, a catchphrase." },
  { ask: "What night was this on?", might: "A day of the week, what came before it, tea in front of the telly." },
  { ask: "Who was your favourite on this?", might: "A character, a presenter, a catchphrase." },
];
const PLACE_PROMPTS: ((where: string) => Prompt)[] = [
  (where) => ({ ask: `Did you ever go to ${where}? What was it like?`, might: "A night out, who they went with, a day they recall." }),
  (where) => ({ ask: `Who would you go to ${where} with?`, might: "Family, friends, a sweetheart, people from work." }),
];
const GROUND = /stadium|park\b.*(fc|football)|\bground\b|ibrox|hampden|anfield|old trafford|celtic park|maine road/i;
// The same song always gets the same prompt; different songs get different ones.
const pick = <T,>(xs: T[], key: string) => xs[[...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % xs.length];

const PROMPTS: Record<"song" | "film" | "tv" | "book" | "place", (title: string) => Prompt> = {
  song: (title) => pick(SONG_PROMPTS, title),
  film: (title) => pick(FILM_PROMPTS, title),
  tv: (title) => pick(TV_PROMPTS, title),
  book: () => ({ ask: "Did you read this? What was it about?", might: "Where they read it, who lent it, a character." }),
  // "the Cavern Club" mid-sentence; a football ground gets the match, not what they wore.
  place: (title) =>
    GROUND.test(title)
      ? { ask: `Did you ever go to a match at ${placeName(title)}? Who did you go with?`, might: "A team, a famous game, who took them, the crowd and the noise." }
      : pick(PLACE_PROMPTS, title)(placeName(title)),
};

/** Today's sponsor names off a place (A12): "O2 Ritz Manchester" → "Ritz Manchester", "(Barclays) Hampden" → "Hampden". */
export function historicName(title: string): string {
  return title
    .replace(/^O2 (Academy |Apollo |Arena |Ritz )?/, (_m, rest: string | undefined) => (rest ?? ""))
    .replace(/^\([^)]*\)\s*/, "")
    .trim();
}

function placeName(title: string): string {
  return historicName(title).replace(/^The /, "the ");
}

export const promptFor = (type: keyof typeof PROMPTS, title: string): Prompt => PROMPTS[type](title);

/** "Out in 1965, when Margaret was 15, in Manchester." Only what's known; null when nothing is. */
export function hookFor(p: Pick<Person, "preferredName" | "birthYear" | "decade" | "places">, item: { type: string; title?: string; year: number | null; placeId?: string; origin: string; like?: string; runTo?: number; standIn?: string }): string {
  const name = p.preferredName || "they";
  if (item.origin === "family") return `The family says ${name} loved this.`;
  // An honest stand-in for a love Qloo didn't know (IM-5).
  if (item.standIn) return `Couldn’t find ‘${item.standIn}’ on Qloo. A stand-in from the same years and town: ${item.title ?? "this"}.`;
  const by = p.birthYear ?? (p.decade !== null ? p.decade + 5 : null);
  // Telly that ran for years of their youth (IM-3): "On the telly all through Joan's twenties".
  const run = item.type === "tv" && by ? youthRun(item.year, item.runTo, by) : null;
  if (run && run.years >= 5) return run.twenties ? `On the telly all through ${name}’s twenties.` : run.teens ? `On the telly all through ${name}’s teens.` : `On the telly from ${run.from} to ${run.to}, when ${name} was ${run.from - by!} to ${run.to - by!}.`;
  const place = p.places.find((x) => x.id === item.placeId)?.name;
  // Where they were that year, from their own places (not where Qloo looked): the line a carer reads aloud (QA-40).
  const thenAt = item.year ? p.places.find((x) => x.fromYear !== null && x.fromYear <= item.year! && (x.toYear === null || item.year! < x.toYear))?.name : undefined;
  // New tries say why, tied to them (QA-42).
  if (item.origin === "new_try") {
    const age = item.year && by ? item.year - by : null;
    const when = age && age >= 5 && age <= 60 ? ` Out in ${item.year}, when ${name} was ${age}.` : "";
    return `${item.like ? `New for ${name}: people who like ${item.like} like this too.` : `Something new for ${name} to try.`}${when}`;
  }
  if (item.type === "place") return place ? `In ${place}, from when ${name} lived there. Still there today.` : `From ${name}'s years and places.`;
  if (item.year && by && item.year - by >= 5 && item.year - by <= 60) return `Out in ${item.year}, when ${name} was ${item.year - by}${thenAt ? ` and living in ${thenAt}` : ""}.`;
  return place ? `Popular in ${place} in ${name}'s young years.` : `From ${name}'s young years.`;
}

/** How many of their ages 10–30 a show's run covers, and whether that's all their teens or twenties (IM-3). */
export function youthRun(from: number | null, to: number | undefined, by: number): { years: number; from: number; to: number; teens: boolean; twenties: boolean } | null {
  if (!from) return null;
  const a = Math.max(from, by + 10);
  const b = Math.min(to ?? from, by + 30);
  if (a > b) return null;
  return { years: b - a + 1, from: a, to: b, teens: a <= by + 13 && b >= by + 19, twenties: a <= by + 20 && b >= by + 29 };
}

/**
 * Why a card is here, in a plain sentence a judge or a carer can read (A8): what Qloo matched (the era, the town, a
 * taste link) or that the family named it. Built from the card's own source line, so it never claims more than that.
 */
export function whyFor(p: Pick<Person, "preferredName" | "places"> & Partial<Pick<Person, "birthYear" | "decade">>, item: { type: string; title: string; by?: string; year?: number | null; origin: string; like?: string; parts: string[]; source: string; placeId?: string; fromStory?: string; story?: string; standIn?: string; worked?: boolean }): string {
  const name = p.preferredName || "them";
  const town = p.places.find((x) => x.id === item.placeId)?.name;
  // Human first, then who found it (UX-3): never "AI pick" or "the model".
  const checked = item.parts.includes("MusicBrainz") ? "; a real recording, checked on MusicBrainz" : "";
  // The badge says "From their story", so the reason does too (FC-4).
  const named = item.fromStory ?? (item.type === "place" ? item.story : undefined);
  if (named) return `The family mentioned it: “${named}”. Found by Qloo${town ? ` in ${town}` : ""}.`;
  if (item.origin === "family") return item.parts.length > 1 && item.by ? `The family named ${item.by}${checked ? `. A real recording, checked on MusicBrainz` : ""}.` : "The family named it.";
  if (item.standIn) return `${item.source.replace(/^Stand-in:\s*/i, "").replace(/\.$/, "")}. A stand-in: it stays a new try until a log shows it works.`;
  if (item.origin === "new_try") {
    // "Because ‘Waterloo’ worked" once it's proven; before that, the family's pick (IM-2).
    if (item.like && item.worked) return `Because ‘${item.like}’ worked, Qloo found more that the same people like.`;
    return item.like ? `The family picked ${item.like}; Qloo found more that the same people like.` : `Like what ${name} loves, found by Qloo.`;
  }
  const by = p.birthYear ?? (p.decade != null ? p.decade + 5 : null);
  const age = item.year && by ? item.year - by : null;
  const where = town ?? item.parts[1];
  const human =
    item.type === "place"
      ? `A long-standing place in ${where}, still there today.`
      : age && age >= 5 && age <= 60
        ? `${item.type === "song" ? "Big" : "Out"}${where ? ` in ${where}` : ""} when ${name} was ${age}.`
        : `Popular${where ? ` around ${where}` : ""} in ${name}’s young years.`;
  // What Qloo matched, never a provenance line in brackets (R2-2): Qloo's own words when the source is Qloo's, else
  // from the card's parts ("60s", "Manchester") → "among Manchester artists of the 60s".
  const said = /^Qloo:/.test(item.source) ? item.source.replace(/^Qloo:\s*/, "").replace(/\.$/, "") : null;
  const [decade, at] = item.parts;
  const among =
    item.type === "place"
      ? ""
      : said && /^(\w+ )?(artists|films|TV)\b/.test(said)
        ? ` among ${said}`
        : item.type === "song" && decade && /^\d0s$/.test(decade)
          ? ` among ${town ?? at} artists of the ${decade}`
          : "";
  // NotOnQ served it (its era fill finds a country's artists Qloo is thin on): say so (F3).
  return `${human} Found ${item.parts.includes("via NotOnQ") ? "via NotOnQ" : "by Qloo"}${among}${checked}.`;
}

/** The same, in a few words for a tile (UX-3): "Manchester · 70s", "Like Lulu", "From the family". No "Qloo", no type. */
export function whyShort(p: Pick<Person, "places">, item: { type: string; origin: string; like?: string; parts: string[]; placeId?: string; fromStory?: string; standIn?: string; worked?: boolean; year?: number | null }): string {
  if (item.fromStory) return "From their story";
  if (item.standIn) return `Stand-in for ‘${item.standIn}’`;
  if (item.worked && item.like) return `Because ‘${item.like}’ worked`;
  if (item.origin === "family") return "From the family";
  if (item.origin === "new_try") return item.like ? `Like ${item.like}` : "New try";
  const town = p.places.find((x) => x.id === item.placeId)?.name;
  const like = item.parts.find((x) => x.startsWith("like "));
  if (like) return `L${like.slice(1)}`;
  // Songs: ["60s", "Glasgow", "British", "Qloo", …] → "Glasgow · British 60s".
  if (item.type === "song") {
    const [decade, at, word] = item.parts;
    const local = word && !["Qloo", "MusicBrainz", "via NotOnQ", "example"].includes(word) ? `${word} ` : "";
    return `${town ?? at} · ${local}${decade}`;
  }
  if (item.type === "place") return `${town ?? item.parts[1]} · long-standing`;
  const when = item.year ? String(item.year) : item.parts[1];
  return [town, when].filter(Boolean).join(" · ") || "Popular then";
}

/** War, crime, horror and the like: not for reminiscence when steer clear points that way, and never first. */
const HARSH = /\b(war|horror|crime|thriller|gangster|prison|slasher|military|disaster|mystery|action|boxing|boxer|martial arts|fight\w*|violen\w*|gun\w*|shoot\w*|explosions?|bomb\w*|battle|combat|murder|western|kidnapp\w*)\b/;
export const isHarsh = (genres: string[] | undefined) => (genres ?? []).some((g) => HARSH.test(g));
/** A film's or show's keywords that make it harsh ("boxing" for Rocky, whose only genre is drama): kept with its genres. */
export const harshKeywords = (keywords: string[]) => keywords.filter((k) => HARSH.test(k)).slice(0, 3);
const GENTLE = /\b(musical|comedy|family|romance|variety|music|animation|soap opera)\b/;
export const isGentle = (genres: string[] | undefined) => (genres ?? []).some((g) => GENTLE.test(g));

/** Steer clear that rules out harsh films and TV altogether: the war, loud bangs, guns, violence, hospitals. */
// Steer clear is in the family's language (F4): "ruidos fuertes" rules out westerns and war films as "loud bangs" does.
export const steerRulesOutHarsh = (p: Pick<Person, "steers">) =>
  p.steers.some((s) => /war|loud|bang|gun|shoot|violen|fight|box|hospital|blood|police|army|bomb|explo|ruido|estruendo|petardo|guerra|tiro|disparo|pelea|sangre|polic[ií]a|ej[ée]rcito|bomba|cohete/i.test(s.label));

/** Places a carer can talk about: not universities, research libraries, offices or hotels (unless the family named them). */
export const isInstitution = (title: string) => /universit|research|institute|college|library|offices?\b|hotel|hostel|hospital|headquarters|\b(ibis|premier inn|travelodge|holiday inn|hilton|marriott|novotel|radisson|mercure|jurys inn)\b/i.test(title);

/** Places to stay or work, by Qloo's category: never the venue the family meant. */
const NOT_A_VENUE = /hotel|hostel|motel|lodging|apartment|bed and breakfast|guest house|office|coworking/;
/** Where people went out, by Qloo's category. */
const VENUE = /music venue|concert|night ?club|ballroom|danc|theat|cinema|movie|stadium|arena|attraction|landmark|historic|museum|pier|park|church|pub|bar|club|hall/;
const SCENE = /music venue|concert|night ?club|ballroom|danc|theat|cinema|stadium|landmark/;

/**
 * The Qloo place the story means ("the Cavern" → The Cavern Club), or nothing when no hit is a sure match: the venue's
 * words must be in the name itself (not after a " - Cavern Quarter" suffix), and a hotel or office never counts. Of the
 * rest, it takes two of: the name starts with the venue's words (or is just them), it's a place people went out, it's a
 * dance hall, music venue or theatre. A bar or a shopping centre that merely shares a word isn't enough.
 */
export function pickVenue<T extends { name: string; categories?: string[] }>(venue: string, results: T[]): T | null {
  const words = nameKey(venue)
    .split(" ")
    .filter((w) => w.length >= 3 && w !== "the");
  if (!words.length) return null;
  const scored = results.flatMap((e) => {
    const core = ` ${nameKey(e.name.split(/\s+[-–|]\s+/)[0]).replace(/^the /, "")} `;
    const cats = (e.categories ?? []).join(" ");
    if (!words.every((w) => core.includes(` ${w} `)) || isInstitution(e.name) || NOT_A_VENUE.test(cats)) return [];
    const lead = ` ${words.join(" ")} `;
    const score = (core === lead ? 2 : core.startsWith(lead) ? 1 : 0) + (VENUE.test(cats) ? 1 : 0) + (SCENE.test(cats) ? 1 : 0);
    return score >= 2 ? [{ e, score }] : [];
  });
  return scored.sort((a, b) => b.score - a.score)[0]?.e ?? null;
}

/** The moment in the story that mentions a place, film or song ("Danced at the Ritz" → "O2 Ritz Manchester"), if any. */
export function inStory(p: Pick<Person, "moments" | "places" | "steers">, title: string): string | null {
  const town = new Set(p.places.map((x) => x.name.toLowerCase()));
  const words = title
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => w.length >= 4 && !town.has(w) && !["the", "theatre", "street", "road", "hall", "park", "club", "centre", "center"].includes(w));
  const hit = p.moments.filter((m) => !momentSteered(p, m)).find((m) => words.some((w) => new RegExp(`\\b${w}\\b`).test(`${m.label} ${m.venue ?? ""}`.toLowerCase())));
  return hit?.label ?? null;
}

/** Songs from a film, to play at the bedside instead of a two-hour film. */
const FILM_SONGS: Record<string, string> = {
  "The Sound of Music": "Edelweiss",
  "Mary Poppins": "A Spoonful of Sugar",
  "The Jungle Book": "The Bare Necessities",
  "Oliver!": "Consider Yourself",
  "Singin' in the Rain": "Singin' in the Rain",
  "Breakfast at Tiffany's": "Moon River",
  Grease: "Summer Nights",
  "Butch Cassidy and the Sundance Kid": "Raindrops Keep Fallin' on My Head",
  "American Graffiti": "Rock Around the Clock",
  "Some Like It Hot": "I Wanna Be Loved by You",
};
export const filmSong = (title: string): string | null => FILM_SONGS[title] ?? null;
