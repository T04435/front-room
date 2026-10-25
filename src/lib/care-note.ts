import type { Kit, LogEntry } from "./kit";
import { GOAL_LABELS } from "./learning";

const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * One line for the home's records after a session: observations, not clinical scores. "18:10, 12 min Chat. Engaged
 * from track 2, sang along to Waterloo. No distress."
 */
export function careNote(kit: Kit, logs: LogEntry[], startedAt: string, endedAt: string): string {
  const real = logs.filter((l) => l.response !== "none");
  const mins = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000));
  const songs = kit.items.filter((i) => i.type === "song");
  const title = (ref: string | null) => kit.items.find((i) => i.ref === ref)?.title;
  const parts = [`${hm(startedAt)}, ${mins} min ${kit.goal ? GOAL_LABELS[kit.goal] : "session"}.`];
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
  parts.push(upsets.length ? `Upset during ${[...new Set(upsets.map((u) => title(u.itemRef) ?? "the session"))].join(" and ")}; stopped and moved to something calm.` : "No distress.");
  if (!real.length) return `${hm(startedAt)}, ${mins} min ${kit.goal ? GOAL_LABELS[kit.goal] : "session"}. No responses logged.`;
  return parts.join(" ");
}
