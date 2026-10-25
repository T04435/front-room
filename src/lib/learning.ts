import type { Kit, KitItem, LogEntry } from "./kit";
import { nameKey } from "./qloo-parse";

/**
 * Kits that learn: Playlist for Life's "test and prune", in rules a coordinator can explain to a family. Product
 * defaults for the demo (product-log, 25 Oct), not research values.
 * - Sang along or engaged in 2 sessions → proven: always in that goal's kit, and on What works.
 * - Upset once → paused: out of the next kit until someone answers (never, sad but OK, or a one-off).
 * - No reaction in 3 sessions (and never a good one) → resting for 30 days.
 */
export const PROVEN_SESSIONS = 2;
export const RESTING_SESSIONS = 3;
export const RESTING_DAYS = 30;

export const GOALS = ["settle", "chat", "sing"] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABELS: Record<Goal, string> = { settle: "Settle", chat: "Chat", sing: "Sing" };
export const GOAL_HINTS: Record<Goal, string> = {
  settle: "Calm, proven things only and few questions. For evenings and before personal care.",
  chat: "One to one, with prompts, films and places.",
  sing: "Builds to a singalong at the end. Good for a group.",
};

/** Settle is the default after 17:00 (the Alzheimer's Association's evening guidance). */
export const defaultGoal = (hour = new Date().getHours()): Goal => (hour >= 17 ? "settle" : "chat");

/** The same thing across kits: its type and title (and a song's artist), however the curator spelled them. */
export function itemKey(i: Pick<KitItem, "type" | "title"> & { by?: { title: string } | string }): string {
  const by = typeof i.by === "string" ? i.by : i.by?.title;
  return `${i.type}:${nameKey(i.title)}${by ? `|${nameKey(by)}` : ""}`;
}

export type ItemState = "proven" | "paused" | "resting" | "tried" | "new";
export type ItemStat = {
  key: string;
  type: KitItem["type"];
  title: string;
  by?: string;
  /** Sessions it was played in (any response logged against it, "no reaction" included). */
  plays: number;
  sangSessions: number;
  engagedSessions: number;
  calmSessions: number;
  upsetSessions: number;
  quietSessions: number;
  lastAt: string | null;
  lastUpsetAt: string | null;
  state: ItemState;
  label: string;
};

export type Logged = LogEntry & { kitId: string };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Every item's record across a person's kits and their logged responses. */
export function itemStats(kits: Kit[], logs: Logged[], resolvedUpsets: string[] = [], now = new Date()): Map<string, ItemStat> {
  const resolved = new Set(resolvedUpsets);
  const stats = new Map<string, ItemStat>();
  for (const kit of kits) {
    const byRef = new Map(kit.items.map((i) => [i.ref, i]));
    const perItem = new Map<string, Logged[]>();
    for (const l of logs) {
      if (l.kitId !== kit.id || !l.itemRef) continue;
      perItem.set(l.itemRef, [...(perItem.get(l.itemRef) ?? []), l]);
    }
    for (const [ref, entries] of perItem) {
      const item = byRef.get(ref);
      if (!item) continue;
      const key = item.key ?? itemKey(item);
      const s =
        stats.get(key) ??
        ({ key, type: item.type, title: item.title, by: item.by?.title, plays: 0, sangSessions: 0, engagedSessions: 0, calmSessions: 0, upsetSessions: 0, quietSessions: 0, lastAt: null, lastUpsetAt: null, state: "new", label: "" } satisfies ItemStat);
      const tags = new Set(entries.map((e) => e.response));
      const last = entries.map((e) => e.at).sort().at(-1)!;
      s.plays++;
      if (tags.has("sang")) s.sangSessions++;
      if (tags.has("engaged")) s.engagedSessions++;
      if (tags.has("calm")) s.calmSessions++;
      if (tags.has("upset")) {
        s.upsetSessions++;
        if (!s.lastUpsetAt || last > s.lastUpsetAt) s.lastUpsetAt = last;
      }
      if ([...tags].every((t) => t === "none")) s.quietSessions++;
      if (!s.lastAt || last > s.lastAt) s.lastAt = last;
      stats.set(key, s);
    }
  }
  for (const s of stats.values()) Object.assign(s, stateOf(s, resolved.has(s.key), now));
  return stats;
}

function stateOf(s: ItemStat, upsetResolved: boolean, now: Date): Pick<ItemStat, "state" | "label"> {
  const good = countGood(s);
  if (s.upsetSessions > 0 && !upsetResolved) return { state: "paused", label: `Paused after an upset on ${day(s.lastUpsetAt!)}` };
  if (good >= PROVEN_SESSIONS) {
    const how = s.sangSessions >= PROVEN_SESSIONS ? `sang along ${times(s.sangSessions)}` : `engaged ${times(good)}`;
    return { state: "proven", label: `Proven · ${how}` };
  }
  if (good === 0 && s.quietSessions >= RESTING_SESSIONS && s.lastAt && now.getTime() - new Date(s.lastAt).getTime() < RESTING_DAYS * 86_400_000) {
    return { state: "resting", label: "Resting · no reaction 3 times" };
  }
  return { state: "tried", label: `Tried ${times(s.plays)}` };
}

/** Sessions with a good reaction (sang along or engaged), counted once per session. */
function countGood(s: ItemStat): number {
  // Each session adds at most one to sang and one to engaged; the larger is a floor, and their sum a ceiling. Sessions
  // where both happened can't be told apart here, so take the larger: the proven rule then never over-counts.
  return Math.max(s.sangSessions, s.engagedSessions);
}

/** What works, most proven first: items that are proven, best evidence first. */
export function topProven(stats: Map<string, ItemStat>, n = 3): ItemStat[] {
  return [...stats.values()].filter((s) => s.state === "proven").sort((a, b) => b.sangSessions + b.engagedSessions - (a.sangSessions + a.engagedSessions) || (b.lastAt ?? "").localeCompare(a.lastAt ?? "")).slice(0, n);
}

/** Proven items that settle: calm in at least one session and never upset. */
export function provenCalm(stats: Map<string, ItemStat>): ItemStat[] {
  return [...stats.values()].filter((s) => s.calmSessions > 0 && s.upsetSessions === 0 && (s.state === "proven" || s.calmSessions >= PROVEN_SESSIONS)).sort((a, b) => b.calmSessions - a.calmSessions);
}
