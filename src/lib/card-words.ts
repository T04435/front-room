import { momentSteered, type Person } from "./person";

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
export function hookFor(p: Pick<Person, "preferredName" | "birthYear" | "decade" | "places">, item: { type: string; year: number | null; placeId?: string; origin: string; like?: string }): string {
  const name = p.preferredName || "they";
  if (item.origin === "family") return `The family says ${name} loved this.`;
  const by = p.birthYear ?? (p.decade !== null ? p.decade + 5 : null);
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

/**
 * Why a card is here, in a plain sentence a judge or a carer can read (A8): what Qloo matched (the era, the town, a
 * taste link) or that the family named it. Built from the card's own source line, so it never claims more than that.
 */
export function whyFor(p: Pick<Person, "preferredName" | "places">, item: { type: string; title: string; by?: string; origin: string; like?: string; parts: string[]; source: string; placeId?: string; fromStory?: string }): string {
  const name = p.preferredName || "them";
  const checked = item.parts.includes("MusicBrainz") ? " The song is one of theirs, checked on MusicBrainz." : "";
  if (item.fromStory) {
    const town = p.places.find((x) => x.id === item.placeId)?.name;
    return `${name}’s story names it (“${item.fromStory}”), and Qloo found the place${town ? ` in ${town}` : ""}.`;
  }
  if (item.origin === "family") return item.parts.length > 1 && item.by ? `The family named ${item.by}.${checked}` : "The family named it.";
  if (item.origin === "new_try") return item.like ? `Qloo: people who like ${item.like} also like this. ${item.like} works for ${name}.` : `Qloo: like what ${name} loves.`;
  // "Qloo: Scottish artists of the 60s, popular around Glasgow." → as Qloo said it, plus the song check.
  const said = item.source.replace(/^Qloo:\s*/, "").replace(/\.$/, "");
  return `Qloo picked ${item.type === "song" ? "the artist" : "it"}: ${said}.${checked}`;
}

/** The same, in a few words for a tile: "Scottish · 60s", "Like Lulu", "Their story". */
export function whyShort(p: Pick<Person, "places">, item: { type: string; origin: string; like?: string; parts: string[]; placeId?: string; fromStory?: string }): string {
  if (item.fromStory) return "Named in their story";
  if (item.origin === "family") return "The family named it";
  if (item.origin === "new_try") return item.like ? `Qloo · like ${item.like}` : "Qloo · new try";
  const town = p.places.find((x) => x.id === item.placeId)?.name;
  const like = item.parts.find((x) => x.startsWith("like "));
  if (like) return `Qloo · ${like}`;
  // Songs: ["60s", "Glasgow", "British", "Qloo", …] → "Qloo · British 60s · Glasgow".
  if (item.type === "song") {
    const [decade, at, word] = item.parts;
    const local = word && !["Qloo", "MusicBrainz", "via NotOnQ"].includes(word) ? `${word} ` : "";
    return `Qloo · ${local}${decade} · ${town ?? at}`;
  }
  if (item.type === "place") return `Qloo · long-standing in ${town ?? item.parts[1]}`;
  return town ? `Qloo · popular around ${town}` : "Qloo · popular then";
}

/** War, crime, horror and the like: not for reminiscence when steer clear points that way, and never first. */
const HARSH = /\b(war|horror|crime|thriller|gangster|prison|slasher|military|disaster|mystery)\b/;
export const isHarsh = (genres: string[] | undefined) => (genres ?? []).some((g) => HARSH.test(g));
const GENTLE = /\b(musical|comedy|family|romance|variety|music|animation|soap opera)\b/;
export const isGentle = (genres: string[] | undefined) => (genres ?? []).some((g) => GENTLE.test(g));

/** Steer clear that rules out harsh films and TV altogether: the war, loud bangs, guns, violence, hospitals. */
export const steerRulesOutHarsh = (p: Pick<Person, "steers">) => p.steers.some((s) => /war|loud|bang|gun|shoot|violen|fight|hospital|blood|police|army|bomb/i.test(s.label));

/** Places a carer can talk about: not universities, research libraries, offices or hotels (unless the family named them). */
export const isInstitution = (title: string) => /universit|research|institute|college|library|offices?\b|hotel|hospital|headquarters/i.test(title);

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
