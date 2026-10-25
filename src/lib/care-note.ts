import type { Kit, LogEntry } from "./kit";

/** Server pages pass the home's time zone (UK for the demo); in the browser the device's own is right. */
const hm = (iso: string, timeZone?: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) });

/**
 * One line for the home's records after a session: observations, not clinical scores. "18:10, 12 min Chat. Engaged
 * from track 2, sang along to Waterloo. No distress."
 */
export function careNote(kit: Kit, logs: LogEntry[], startedAt: string, endedAt: string, timeZone?: string): string {
  const real = logs.filter((l) => l.response !== "none");
  const mins = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000));
  const songs = kit.items.filter((i) => i.type === "song");
  const title = (ref: string | null) => kit.items.find((i) => i.ref === ref)?.title;
  const parts = [`${hm(startedAt, timeZone)}, ${mins} min ${kit.goal ? kit.goal.charAt(0).toUpperCase() + kit.goal.slice(1) : "session"}.`];
  const firstEngaged = real.find((l) => l.response === "engaged" || l.response === "sang");
  const track = firstEngaged?.itemRef ? songs.findIndex((s) => s.ref === firstEngaged.itemRef) + 1 : 0;
  const sang = [...new Set(real.filter((l) => l.response === "sang").map((l) => title(l.itemRef)).filter(Boolean))];
  const calm = real.some((l) => l.response === "calm");
  const bits: string[] = [];
  if (firstEngaged) bits.push(track > 0 ? `Engaged from track ${track}` : "Engaged");
  if (sang.length) bits.push(`sang along to ${sang.join(" and ")}`);
  if (!bits.length && calm) bits.push("Calm throughout");
  if (bits.length) parts.push(`${bits.join(", ").replace(/^./, (c) => c.toUpperCase())}.`);
  const upsets = real.filter((l) => l.response === "upset");
  parts.push(upsets.length ? `Upset during ${[...new Set(upsets.map((u) => title(u.itemRef) ?? "the session"))].join(" and ")}; stopped.` : "No distress.");
  if (!real.length) return `${hm(startedAt, timeZone)}, ${mins} min ${kit.goal ? kit.goal.charAt(0).toUpperCase() + kit.goal.slice(1) : "session"}. No responses logged.`;
  return parts.join(" ");
}

/**
 * The care note for a day's plays from the gallery: "18:10, 12 min. Engaged with The Sound of Music, sang along to
 * Waterloo. No distress." Observations, not scores.
 */
export function careNoteForPlays(plays: import("./learning").Play[], timeZone?: string): string | null {
  const real = plays.filter((p) => p.response !== "none");
  if (!real.length) return null;
  const start = real[0].at;
  const mins = Math.max(1, Math.round((new Date(real.at(-1)!.at).getTime() - new Date(start).getTime()) / 60_000) + 3);
  const titles = (r: string) => [...new Set(real.filter((p) => p.response === r).map((p) => p.title))];
  const sang = titles("sang");
  const engaged = titles("engaged").filter((t) => !sang.includes(t));
  const calm = titles("calm");
  const upset = titles("upset");
  const tearful = titles("tearful");
  const bits = [engaged.length ? `engaged with ${engaged.join(" and ")}` : null, sang.length ? `sang along to ${sang.join(" and ")}` : null, !engaged.length && !sang.length && calm.length ? `calm with ${calm.join(" and ")}` : null].filter(Boolean).join(", ");
  return `${hm(start, timeZone)}, about ${mins} min.${bits ? ` ${bits.charAt(0).toUpperCase()}${bits.slice(1)}.` : ""} ${tearful.length ? `Tearful with ${tearful.join(" and ")}. ` : ""}${upset.length ? `Upset during ${upset.join(" and ")}; stopped.` : "No distress."}`;
}
