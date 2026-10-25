import "server-only";
import { createHash } from "node:crypto";
import { DEVICE_COOKIE, isDeviceId } from "@/lib/device";
import { db } from "@/server/db";

/**
 * Daily budgets and per-visitor limits, sized for a judging room, so a busy room can't run up Qloo (one key shared by
 * every entry) or the model. When a limit is hit the app says so plainly and points to saved kits, which always open.
 * - Visitors are counted per device (the `fr_device` cookie), with a looser per-network (hashed IP) ceiling behind it.
 * - "Limits off until <time>" (judging days) skips the per-visitor limits and swaps in the higher judging budgets. Set it
 *   with FRONT_ROOM_LIMITS_OFF_UNTIL, or the `settings` row `limits_off_until` (no redeploy).
 * Every number is an env var. Counters live in the database (table `usage`).
 */
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limits() {
  const e = process.env;
  return {
    /** Kits built per UTC day (one model call each, about US$0.02). */
    runsPerDay: num(e.FRONT_ROOM_RUNS_PER_DAY, 300),
    runsPerDayJudging: num(e.FRONT_ROOM_RUNS_PER_DAY_JUDGING, 1000),
    /** Live (uncached) Qloo calls per UTC day; a run makes about 8. */
    qlooPerDay: num(e.FRONT_ROOM_QLOO_PER_DAY, 2500),
    qlooPerDayJudging: num(e.FRONT_ROOM_QLOO_PER_DAY_JUDGING, 8000),
    qlooPerRun: num(e.FRONT_ROOM_QLOO_PER_RUN, 12),
    device: { run: num(e.FRONT_ROOM_RUNS_PER_DEVICE_HOUR, 20), log: num(e.FRONT_ROOM_LOGS_PER_DEVICE_HOUR, 600) },
    network: { run: num(e.FRONT_ROOM_RUNS_PER_IP_HOUR, 200), log: num(e.FRONT_ROOM_LOGS_PER_IP_HOUR, 6000) },
  };
}

const DAY = 86_400;
const HOUR = 3_600;

/** The bucket a counter falls in: its key plus the start of its window, so each window counts from zero. */
export function bucket(key: string, windowSeconds: number, now = Date.now()): { name: string; expires: Date } {
  const start = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  return { name: `${key}:${start}`, expires: new Date((start + windowSeconds) * 1000) };
}

async function add(name: string, n: number, expires: Date): Promise<number> {
  const sql = await db();
  if (Math.random() < 0.02) await sql.query("DELETE FROM usage WHERE expires_at < now()");
  const rows = await sql.query<{ count: number }>(
    "INSERT INTO usage (bucket, count, expires_at) VALUES ($1, $2, $3) ON CONFLICT (bucket) DO UPDATE SET count = usage.count + $2 RETURNING count",
    [name, n, expires.toISOString()],
  );
  return Number(rows[0]?.count ?? n);
}

async function read(name: string): Promise<number> {
  const sql = await db();
  const rows = await sql.query<{ count: number }>("SELECT count FROM usage WHERE bucket = $1", [name]);
  return Number(rows[0]?.count ?? 0);
}

let offCache: { until: number; read: number } | null = null;

async function offUntil(): Promise<number> {
  const fromEnv = Date.parse(process.env.FRONT_ROOM_LIMITS_OFF_UNTIL ?? "");
  if (Number.isFinite(fromEnv)) return fromEnv;
  if (offCache && Date.now() - offCache.read < 30_000) return offCache.until;
  try {
    const sql = await db();
    const rows = await sql.query<{ value: string }>("SELECT value FROM settings WHERE key = 'limits_off_until'");
    const until = Date.parse(rows[0]?.value ?? "");
    offCache = { until: Number.isFinite(until) ? until : 0, read: Date.now() };
  } catch {
    offCache = { until: 0, read: Date.now() };
  }
  return offCache.until;
}

export async function limitsOff(): Promise<boolean> {
  return (await offUntil()) > Date.now();
}

const hash = (value: string) => createHash("sha256").update(`front-room:${value}`).digest("hex").slice(0, 16);

/** A network's id for the backstop: a hash of the IP Vercel saw, never the IP itself. */
export function visitor(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return hash(ip);
}

/** The raw device id from the cookie (the saved kits' owner), or null. */
export function deviceId(cookieHeader: string | null): string | null {
  const value = (cookieHeader ?? "")
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === DEVICE_COOKIE)?.[1];
  return isDeviceId(value) ? value : null;
}

export type Refusal = { error: string; status: 429; retryAfter: number };

function refusal(error: string, until: Date): Refusal {
  return { error, status: 429, retryAfter: Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000)) };
}

const WHAT = { run: "kits built", log: "responses logged" } as const;

/** Counts one use against this device's and this network's hourly limits; a refusal when either is over. */
export async function perVisitor(kind: "run" | "log", request: Request): Promise<Refusal | null> {
  if (await limitsOff()) return null;
  const { device, network } = limits();
  const id = deviceId(request.headers.get("cookie"));
  if (id) {
    const b = bucket(`dev:${kind}:${hash(id)}`, HOUR);
    if ((await add(b.name, 1, b.expires)) > device[kind]) return refusal(`This browser has reached this hour's limit of ${WHAT[kind]} (${device[kind]}). Saved kits still open.`, b.expires);
  }
  const b = bucket(`ip:${kind}:${visitor(request)}`, HOUR);
  if ((await add(b.name, 1, b.expires)) > network[kind]) return refusal(`Your network has reached this hour's limit of ${WHAT[kind]} (${network[kind]}). Saved kits still open.`, b.expires);
  return null;
}

/** Whether today's budgets have room for one more run (and takes it from the run budget). */
export async function takeRun(): Promise<Refusal | null> {
  const off = await limitsOff();
  const l = limits();
  const q = bucket("qloo", DAY);
  if ((await read(q.name)) + l.qlooPerRun > (off ? l.qlooPerDayJudging : l.qlooPerDay)) {
    return refusal("Today's research budget is used up. New kits come back tomorrow (UTC); saved kits still open.", q.expires);
  }
  const r = bucket("runs", DAY);
  if ((await add(r.name, 1, r.expires)) > (off ? l.runsPerDayJudging : l.runsPerDay)) {
    return refusal("Today's kit budget is used up. New kits come back tomorrow (UTC); saved kits still open.", r.expires);
  }
  return null;
}

export async function addQlooCalls(calls: number): Promise<void> {
  if (calls <= 0) return;
  const b = bucket("qloo", DAY);
  await add(b.name, calls, b.expires);
}

export function refusalResponse(r: Refusal): Response {
  return Response.json({ error: r.error, budget: true }, { status: r.status, headers: { "Retry-After": String(r.retryAfter) } });
}
