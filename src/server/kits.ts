import "server-only";
import { randomBytes } from "node:crypto";
import { EXAMPLE_KIT, EXAMPLE_KIT_ID } from "@/lib/example-kit";
import { EXAMPLE_KITS, EXAMPLE_LOGS, isExampleKitId } from "@/lib/example-person";
import type { Kit, LogEntry, Response } from "@/lib/kit";
import { db } from "@/server/db";

/** Kit ids: 10 url-safe characters, unguessable enough that a share link is the only way in. */
export function newKitId(): string {
  return randomBytes(8).toString("base64url").slice(0, 10);
}

export const isKitId = (id: string) => /^[A-Za-z0-9_-]{10}$/.test(id);

export async function saveKit(kit: Kit, owner: string | null): Promise<void> {
  const sql = await db();
  await sql.query("INSERT INTO kits (id, owner, kit, created_at, person_id) VALUES ($1, $2, $3, $4, $5)", [kit.id, owner, JSON.stringify(kit), kit.createdAt, kit.personId ?? null]);
}

/** A saved kit, or the built-in example (no database needed, so it opens even with the database down). */
export async function getKit(id: string): Promise<Kit | null> {
  if (id === EXAMPLE_KIT_ID) return EXAMPLE_KIT;
  if (isExampleKitId(id)) return EXAMPLE_KITS.find((k) => k.id === id) ?? null;
  if (!isKitId(id)) return null;
  const sql = await db();
  const rows = await sql.query<{ kit: Kit | string }>("SELECT kit FROM kits WHERE id = $1", [id]);
  const kit = rows[0]?.kit;
  return kit ? (typeof kit === "string" ? (JSON.parse(kit) as Kit) : kit) : null;
}

export type KitSummary = { id: string; title: { name?: string; place: string; from: number; to: number }; songs: number; picks: number; responses: number; createdAt: string };

/** This browser's kits, newest first, with how many responses each has logged. */
export async function listKits(owner: string | null, limit = 50): Promise<KitSummary[]> {
  if (!owner) return [];
  const sql = await db();
  const rows = await sql.query<{ id: string; kit: Kit | string; responses: number | string }>(
    `SELECT k.id, k.kit, (SELECT count(*) FROM responses r WHERE r.kit_id = k.id) AS responses
       FROM kits k WHERE k.owner = $1 ORDER BY k.created_at DESC LIMIT $2`,
    [owner, limit],
  );
  return rows.map((r) => {
    const kit = typeof r.kit === "string" ? (JSON.parse(r.kit) as Kit) : r.kit;
    return {
      id: r.id,
      title: { name: kit.brief.name, place: kit.place, from: kit.era.from, to: kit.era.to },
      songs: kit.items.filter((i) => i.type === "song").length,
      picks: kit.items.filter((i) => i.why && i.type !== "song").length,
      responses: Number(r.responses),
      createdAt: kit.createdAt,
    };
  });
}

export async function logResponse(kitId: string, response: Response, itemRef: string | null): Promise<LogEntry> {
  const sql = await db();
  const rows = await sql.query<{ id: number; at: string | Date }>("INSERT INTO responses (kit_id, response, item_ref) VALUES ($1, $2, $3) RETURNING id, at", [kitId, response, itemRef]);
  return { id: rows[0].id, response, itemRef, at: new Date(rows[0].at).toISOString() };
}

export async function getResponses(kitId: string): Promise<LogEntry[]> {
  if (isExampleKitId(kitId)) return EXAMPLE_LOGS.filter((l) => l.kitId === kitId);
  const sql = await db();
  const rows = await sql.query<{ id: number; response: Response; item_ref: string | null; at: string | Date }>(
    "SELECT id, response, item_ref, at FROM responses WHERE kit_id = $1 ORDER BY at, id",
    [kitId],
  );
  return rows.map((r) => ({ id: r.id, response: r.response, itemRef: r.item_ref, at: new Date(r.at).toISOString() }));
}

export async function undoResponse(kitId: string, id: number): Promise<void> {
  const sql = await db();
  await sql.query("DELETE FROM responses WHERE kit_id = $1 AND id = $2", [kitId, id]);
}
