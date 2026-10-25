/**
 * The era a kit is built on: the years someone was 15 to 25 (the "reminiscence bump", when music sticks hardest), and
 * the decades those years fall in, as Qloo's decade genre tags name them.
 */

export const BUMP_FROM_AGE = 15;
export const BUMP_TO_AGE = 25;
export const MIN_BIRTH_YEAR = 1915;
export const MAX_BIRTH_YEAR = 1995;

export type Era = { from: number; to: number; decades: Decade[] };
/** `years`: how many of the era's years fall in this decade; the bigger share leads. */
export type Decade = { start: number; short: string; years: number };

export function eraFor(birthYear: number): Era {
  const from = birthYear + BUMP_FROM_AGE;
  const to = birthYear + BUMP_TO_AGE;
  const decades: Decade[] = [];
  for (let start = Math.floor(from / 10) * 10; start <= to; start += 10) {
    const years = Math.min(to, start + 9) - Math.max(from, start) + 1;
    decades.push({ start, short: decadeShort(start), years });
  }
  return { from, to, decades: decades.sort((a, b) => b.years - a.years || a.start - b.start) };
}

/** 1960 → "60s"; 2000 → "2000s" (Qloo's tags drop the century before 2000). */
export function decadeShort(start: number): string {
  return start >= 2000 ? `${start}s` : `${String(start).slice(2)}s`;
}

const WORDS: Record<number, string> = { 1920: "twenties", 1930: "thirties", 1940: "forties", 1950: "fifties", 1960: "sixties", 1970: "seventies", 1980: "eighties", 1990: "nineties" };

/** The last segments a decade's music tag can have in Qloo: "60s", "sixties", "1960s". */
export function decadeTagNames(start: number): string[] {
  return [decadeShort(start), WORDS[start], `${start}s`].filter((x): x is string => Boolean(x));
}

/**
 * The decade's music tag among a tag search's results: the one whose id ends in the decade's name, never a subgenre
 * ("60s rock", "60s revival"). Null when Qloo has none.
 */
export function pickDecadeTag(tags: { id: string; name: string }[], start: number): { id: string; name: string } | null {
  const names = decadeTagNames(start);
  return tags.find((t) => t.id.startsWith("urn:tag:genre:music:") && names.includes(t.id.slice("urn:tag:genre:music:".length))) ?? null;
}

export function describeEra(era: Era): string {
  return `${era.from}–${era.to}`;
}
