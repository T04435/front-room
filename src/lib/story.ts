import { type Fact, LOVE_TYPES, MOMENT_KINDS, type Person, type Place, type Steer } from "./person";
import { nameKey } from "./qloo-parse";

/** Short ids for story entries. */
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const yearIn = (f: Fact) => f.fromYear ?? (/^\d{4}$/.test(f.value.trim()) ? Number(f.value.trim()) : null);
const append = (a: string | undefined, b: string) => (a && !a.toLowerCase().includes(b.toLowerCase()) ? `${a}; ${b}` : a || b);

/** How a candidate fact reads on a "here's what I heard" card. */
export function describeFact(f: Fact): string {
  switch (f.kind) {
    case "preferredName":
      return `Likes to be called ${f.value}`;
    case "birthYear":
      return `Born ${yearIn(f) ?? f.value}`;
    case "decade":
      return `Born in the ${yearIn(f) ?? f.value}s`;
    case "place":
      return `${f.value}${f.fromYear || f.toYear ? `, ${f.fromYear ?? "?"}–${f.toYear ?? "?"}` : ""}${f.detail ? ` (${f.detail})` : ""}`;
    case "moment":
      return `${f.value}${f.fromYear ? `, ${f.fromYear}` : ""}`;
    case "love":
      return `Loves ${f.value}${f.extra ? ` (${f.extra})` : ""}${f.detail ? ` · ${f.detail}` : ""}`;
    case "painful":
      return f.value;
    case "calms":
      return `Calmed by ${f.value}`;
    case "upsets":
      return `Upset by ${f.value}`;
    case "work":
      return `Work: ${f.value}`;
    case "faith":
      return `Faith: ${f.value}`;
    case "hearing":
      return `Hearing: ${f.value}`;
    case "language":
      return `Speaks ${f.value}`;
    case "greeting":
      return `Greeting: ${f.value}`;
    case "bestTime":
      return `Best time: ${f.value}`;
  }
}

/** Adds a place, or fills in the years of one already there (same name). */
export function addPlace(p: Person, place: Omit<Place, "id"> & { id?: string }): Person {
  const same = p.places.find((x) => nameKey(x.name) === nameKey(place.name));
  if (same) {
    return { ...p, places: p.places.map((x) => (x === same ? { ...x, fromYear: x.fromYear ?? place.fromYear, toYear: x.toYear ?? place.toYear, role: x.role ?? place.role, label: x.label ?? place.label } : x)) };
  }
  return { ...p, places: [...p.places, { ...place, id: place.id ?? uid("pl") }].sort((a, b) => (a.fromYear ?? 9999) - (b.fromYear ?? 9999)) };
}

/** Records a steer-clear answer: "never" or "sad but OK" keep the label (only the label); "no need" keeps nothing. */
export function addSteer(p: Person, label: string, level: Steer["level"] | "no_need", kind: Steer["kind"] = "topic", source: Steer["source"] = "family"): Person {
  const asked = { ...p, steerAsked: true };
  if (level === "no_need") return asked;
  const rest = asked.steers.filter((s) => nameKey(s.label) !== nameKey(label));
  return { ...asked, steers: [...rest, { id: uid("st"), kind, label: label.trim().slice(0, 60), level, source, at: new Date().toISOString() }] };
}

/** A confirmed fact into the story. Painful mentions don't come here: they become a steer-clear question (addSteer). */
export function applyFact(p: Person, f: Fact): Person {
  const v = f.value.trim();
  const quote = f.quote || undefined;
  switch (f.kind) {
    case "preferredName":
      return { ...p, preferredName: v.slice(0, 40) };
    case "birthYear": {
      const y = yearIn(f);
      return y ? { ...p, birthYear: y } : p;
    }
    case "decade": {
      const y = yearIn(f);
      return y ? { ...p, decade: Math.floor(y / 10) * 10 } : p;
    }
    case "place":
      return addPlace(p, { name: v, fromYear: f.fromYear, toYear: f.toYear, role: f.detail ?? undefined });
    case "moment": {
      const kind = (MOMENT_KINDS as readonly string[]).includes(f.detail ?? "") ? (f.detail as Person["moments"][number]["kind"]) : "other";
      if (p.moments.some((m) => nameKey(m.label) === nameKey(v))) return p;
      return { ...p, moments: [...p.moments, { id: uid("mo"), kind, year: f.fromYear, label: v, ...(f.extra ? { venue: f.extra } : {}) }] };
    }
    case "love": {
      const type = (LOVE_TYPES as readonly string[]).includes(f.detail ?? "") ? (f.detail as Person["loves"][number]["type"]) : "other";
      if (p.loves.some((l) => nameKey(l.title) === nameKey(v))) return p;
      const source = p.consent?.by === "self" ? "self" : "family";
      return { ...p, loves: [...p.loves, { id: uid("lv"), type, title: v, ...(f.extra ? { by: f.extra } : {}), year: f.fromYear, source, ...(quote ? { quote } : {}) }] };
    }
    case "painful":
      return addSteer(p, v, "never");
    case "upsets":
      return addSteer(p, v, "never", "topic");
    case "calms":
      return { ...p, practical: { ...p.practical, calms: append(p.practical.calms, v) } };
    case "work":
      return { ...p, practical: { ...p.practical, work: append(p.practical.work, v) } };
    case "faith":
      return { ...p, practical: { ...p.practical, faith: /keep (it )?out|no faith|none/i.test(v) ? { stance: "keep_out" } : { stance: "yes", label: v.slice(0, 60) } } };
    case "hearing":
      return { ...p, practical: { ...p.practical, hearing: append(p.practical.hearing, v), ...(/no headphones|hate headphones/i.test(v) ? { headphonesOk: false } : {}) } };
    case "language":
      return p.languages.some((l) => nameKey(l) === nameKey(v)) ? p : { ...p, languages: [...p.languages, v.slice(0, 30)] };
    case "greeting":
      return { ...p, practical: { ...p.practical, greeting: v } };
    case "bestTime":
      return { ...p, practical: { ...p.practical, bestTime: v } };
  }
}

/** The fields a story change touches, for PATCH /api/people/[id]. */
export function storyPatch(p: Person) {
  const { preferredName, birthYear, decade, languages, consent, places, moments, loves, steers, steerAsked, practical, staffHeard, resolvedUpsets } = p;
  return { preferredName, birthYear, decade, languages, consent, places, moments, loves, steers, steerAsked, practical, staffHeard, resolvedUpsets };
}

/** Places that still need years (a year picker each). */
export const placesWithoutYears = (p: Person) => p.places.filter((x) => x.fromYear === null || (x.toYear === null && x !== p.places.at(-1)));

/** A suggestion in the returning chat: tapping it opens its typed input. */
export type Help =
  | { id: string; kind: "upset"; label: string; itemKey: string; itemTitle: string; tearful?: boolean }
  | { id: string; kind: "steer" | "place" | "moment" | "calms" | "work" | "faith" | "hearing"; label: string }
  | { id: string; kind: "heard"; label: string; heardId: string };

// In the home's zone, as the gallery and What works are (QA-32).
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

/**
 * What would help next, most useful first (v2 brief): an unresolved upset or no steer-clear answer; more places and
 * years; big moments; what calms them when Settle has fewer than 3 proven items; work, faith, hearing; staff-heard
 * items to confirm.
 */
export function wouldHelpNext(p: Person, paused: { key: string; title: string; lastUpsetAt: string | null; tearful?: boolean }[], provenCalm: number): Help[] {
  const name = p.preferredName || "they";
  const out: Help[] = [];
  const steered = new Set(p.steers.map((s) => nameKey(s.label)));
  for (const u of paused) {
    if (p.resolvedUpsets.includes(u.key) || steered.has(nameKey(u.title))) continue;
    out.push({ id: `up-${u.key}`, kind: "upset", label: u.tearful ? `${p.preferredName || "They"} was tearful during ${u.title}: keep it (sad but OK) or steer clear?` : u.lastUpsetAt ? `Upset during ${u.title} on ${day(u.lastUpsetAt)}: steer clear?` : `Tearful with ${u.title}: steer clear?`, itemKey: u.key, itemTitle: u.title, ...(u.tearful ? { tearful: true } : {}) });
  }
  if (!p.steerAsked && !p.steers.length) out.push({ id: "steer", kind: "steer", label: "Anything to steer clear of?" });
  const last = p.places.at(-1);
  out.push({ id: "place", kind: "place", label: last ? `After ${last.name}, where did ${name} live?` : `Where did ${name} grow up?` });
  if (!p.moments.some((m) => m.kind === "wedding" || m.kind === "dance")) out.push({ id: "moment", kind: "moment", label: "A wedding, or dancing?" });
  if (provenCalm < 3 && !p.practical.calms) out.push({ id: "calms", kind: "calms", label: `What calms ${name}?` });
  if (!p.practical.work) out.push({ id: "work", kind: "work", label: "Their work" });
  if (!p.practical.faith) out.push({ id: "faith", kind: "faith", label: "Faith, or keep it out?" });
  if (!p.practical.hearing && p.practical.headphonesOk === undefined) out.push({ id: "hearing", kind: "hearing", label: "Hearing and headphones" });
  for (const h of p.staffHeard.filter((x) => !x.confirmed)) out.push({ id: `h-${h.id}`, kind: "heard", label: `Staff heard: “${h.text}”`, heardId: h.id });
  return out;
}
