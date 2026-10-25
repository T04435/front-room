import type { Person } from "./person";

/**
 * What a card says to the carer: a hook tied to the person, and one open prompt (never testing, never the word
 * "remember"), with what they might answer. Written here from the item and the story, so it costs nothing and never
 * guesses: a hook only states what we know (the year, their age then, the place).
 */
export type Prompt = { ask: string; might: string };

const PROMPTS: Record<"song" | "film" | "tv" | "book" | "place", (title: string) => Prompt> = {
  song: () => ({ ask: "Did you ever dance to this? Where was it playing?", might: "A dance hall, a wedding, the radio at home, a name." }),
  film: () => ({ ask: "Did you see this at the pictures? Who did you go with?", might: "A friend or a sweetheart, the cinema's name, a favourite song from it." }),
  tv: () => ({ ask: "Did you watch this at home? Who watched it with you?", might: "Family round the set, a favourite character, a catchphrase." }),
  book: () => ({ ask: "Did you read this? What was it about?", might: "Where they read it, who lent it, a character." }),
  place: (title) => ({ ask: `Did you ever go to ${title}? What was it like?`, might: "A night out, who they went with, what they wore." }),
};

export const promptFor = (type: keyof typeof PROMPTS, title: string): Prompt => PROMPTS[type](title);

/** "Out in 1965, when Margaret was 15, in Manchester." Only what's known; null when nothing is. */
export function hookFor(p: Pick<Person, "preferredName" | "birthYear" | "decade" | "places">, item: { type: string; year: number | null; placeId?: string; origin: string; like?: string }): string {
  const name = p.preferredName || "they";
  if (item.origin === "family") return `The family says ${name} loved this.`;
  const by = p.birthYear ?? (p.decade !== null ? p.decade + 5 : null);
  const place = p.places.find((x) => x.id === item.placeId)?.name;
  if (item.origin === "new_try") return item.like ? `New: people who like ${item.like} like this too.` : "Something new to try.";
  if (item.type === "place") return place ? `In ${place}, from when ${name} lived there. Still there today.` : `From ${name}'s years and places.`;
  if (item.year && by && item.year - by >= 5 && item.year - by <= 60) return `Out in ${item.year}, when ${name} was ${item.year - by}${place ? `, in ${place}` : ""}.`;
  return place ? `Popular in ${place} in ${name}'s young years.` : `From ${name}'s young years.`;
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
export function inStory(p: Pick<Person, "moments" | "places">, title: string): string | null {
  const town = new Set(p.places.map((x) => x.name.toLowerCase()));
  const words = title
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => w.length >= 4 && !town.has(w) && !["the", "theatre", "street", "road", "hall", "park", "club", "centre", "center"].includes(w));
  const hit = p.moments.find((m) => words.some((w) => new RegExp(`\\b${w}\\b`).test(`${m.label} ${m.venue ?? ""}`.toLowerCase())));
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
