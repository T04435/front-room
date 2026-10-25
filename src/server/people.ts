import "server-only";
import { randomBytes } from "node:crypto";
import { EXAMPLE_KITS, EXAMPLE_LOGS, EXAMPLE_PERSON, EXAMPLE_PERSON_ID, EXAMPLE_PLAYS } from "@/lib/example-person";
import type { Kit } from "@/lib/kit";
import type { Logged, Play } from "@/lib/learning";
import { completeness, type Person, type PersonSummary } from "@/lib/person";
import { db } from "@/server/db";

/** Person ids are the private link: 10 url-safe characters, unguessable. */
export const newPersonId = () => randomBytes(8).toString("base64url").slice(0, 10);
export const isPersonId = (id: string) => id === EXAMPLE_PERSON_ID || /^[A-Za-z0-9_-]{10}$/.test(id);

const parse = <T,>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);

export async function getPerson(id: string): Promise<Person | null> {
  if (id === EXAMPLE_PERSON_ID) return EXAMPLE_PERSON;
  if (!isPersonId(id)) return null;
  const sql = await db();
  const rows = await sql.query<{ person: Person | string }>("SELECT person FROM people WHERE id = $1", [id]);
  return rows[0] ? parse(rows[0].person) : null;
}

/** Saves a person (never the example, which is read-only). */
export async function savePerson(person: Person): Promise<Person> {
  if (person.example || person.id === EXAMPLE_PERSON_ID) throw new Error("The example is read-only");
  const next = { ...person, updatedAt: new Date().toISOString() };
  const sql = await db();
  await sql.query("INSERT INTO people (id, person, updated_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO UPDATE SET person = $2, updated_at = now()", [next.id, JSON.stringify(next)]);
  return next;
}

/** Puts a person on a device's list (on creating them, or opening their link). */
export async function linkDevice(deviceId: string | null, personId: string): Promise<void> {
  if (!deviceId || personId === EXAMPLE_PERSON_ID) return;
  const sql = await db();
  await sql.query("INSERT INTO device_people (device_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [deviceId, personId]);
}

export async function unlinkDevice(deviceId: string | null, personId: string): Promise<void> {
  if (!deviceId) return;
  const sql = await db();
  await sql.query("DELETE FROM device_people WHERE device_id = $1 AND person_id = $2", [deviceId, personId]);
}

/** A person's kits, oldest first. */
export async function personKits(personId: string): Promise<Kit[]> {
  if (personId === EXAMPLE_PERSON_ID) return EXAMPLE_KITS;
  const sql = await db();
  const rows = await sql.query<{ kit: Kit | string }>("SELECT kit FROM kits WHERE person_id = $1 ORDER BY created_at", [personId]);
  return rows.map((r) => parse(r.kit));
}

/** Everything logged in a person's kits. */
export async function personLogs(personId: string): Promise<Logged[]> {
  if (personId === EXAMPLE_PERSON_ID) return EXAMPLE_LOGS;
  const sql = await db();
  const rows = await sql.query<{ id: number; kit_id: string; response: Logged["response"]; item_ref: string | null; at: string | Date }>(
    "SELECT r.id, r.kit_id, r.response, r.item_ref, r.at FROM responses r JOIN kits k ON k.id = r.kit_id WHERE k.person_id = $1 ORDER BY r.at, r.id",
    [personId],
  );
  return rows.map((r) => ({ id: r.id, kitId: r.kit_id, response: r.response, itemRef: r.item_ref, at: new Date(r.at).toISOString() }));
}

function summarise(p: Person, kits: { createdAt: string }[]): PersonSummary {
  return {
    id: p.id,
    preferredName: p.preferredName,
    completeness: completeness(p),
    sessions: kits.length,
    lastSession: kits.at(-1)?.createdAt ?? null,
    ready: Object.values(p.suggestions).some((cs) => cs.length),
    example: Boolean(p.example),
  };
}

/** This device's people, most recently changed first, then the example Margaret. */
export async function listPeople(deviceId: string | null): Promise<PersonSummary[]> {
  const out: PersonSummary[] = [];
  if (deviceId) {
    const sql = await db();
    const rows = await sql.query<{ person: Person | string; kits: number | string; last: string | Date | null }>(
      `SELECT p.person,
              (SELECT count(DISTINCT date(pl.at)) FROM plays pl WHERE pl.person_id = p.id) AS kits,
              (SELECT max(pl.at) FROM plays pl WHERE pl.person_id = p.id) AS last
         FROM device_people d JOIN people p ON p.id = d.person_id
        WHERE d.device_id = $1 ORDER BY p.updated_at DESC`,
      [deviceId],
    );
    for (const r of rows) {
      const p = parse(r.person);
      // "Sessions" are days with plays; "ready" means their gallery has things in it.
      const s = { ...summarise(p, []), ready: Object.values(p.suggestions).some((cs) => cs.length) };
      out.push({ ...s, sessions: Number(r.kits), lastSession: r.last ? new Date(r.last).toISOString() : null });
    }
  }
  out.push(summarise(EXAMPLE_PERSON, EXAMPLE_KITS));
  return out;
}

/** Everything played for a person from their gallery, oldest first. */
export async function personPlays(personId: string): Promise<Play[]> {
  if (personId === EXAMPLE_PERSON_ID) return EXAMPLE_PLAYS;
  const sql = await db();
  const rows = await sql.query<{ id: number; item_key: string; item_type: Play["type"]; title: string; by_name: string | null; response: Play["response"]; at: string | Date }>(
    "SELECT id, item_key, item_type, title, by_name, response, at FROM plays WHERE person_id = $1 ORDER BY at, id",
    [personId],
  );
  return rows.map((r) => ({ id: r.id, itemKey: r.item_key, type: r.item_type, title: r.title, ...(r.by_name ? { by: r.by_name } : {}), response: r.response, at: new Date(r.at).toISOString() }));
}

export async function addPlay(personId: string, play: Omit<Play, "id" | "at">): Promise<Play> {
  const sql = await db();
  const rows = await sql.query<{ id: number; at: string | Date }>(
    "INSERT INTO plays (person_id, item_key, item_type, title, by_name, response) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, at",
    [personId, play.itemKey, play.type, play.title, play.by ?? null, play.response],
  );
  return { ...play, id: rows[0].id, at: new Date(rows[0].at).toISOString() };
}

export async function undoPlay(personId: string, id: number): Promise<void> {
  const sql = await db();
  await sql.query("DELETE FROM plays WHERE person_id = $1 AND id = $2", [personId, id]);
}
