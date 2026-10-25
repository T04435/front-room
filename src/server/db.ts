import "server-only";
import { neon } from "@neondatabase/serverless";
import { migrate, type Sql } from "@/lib/migrate";
import { env, offline } from "@/server/env";

/**
 * The database: Neon (Vercel integration) when DATABASE_URL is set, else PGlite in .data/ for local development (and
 * in memory under tests and offline e2e). The schema is created on first use, through the same driver production uses.
 */
// On globalThis: Next's dev server loads route handlers and pages in separate module graphs, and two PGlite instances on
// one data folder don't see each other's writes.
const store = globalThis as typeof globalThis & { __frontRoomDb?: Promise<Sql> | null };

async function open(): Promise<Sql> {
  let sql: Sql;
  if (env.DATABASE_URL) {
    const neonSql = neon(env.DATABASE_URL);
    sql = { query: async <T,>(text: string, params?: unknown[]) => (await neonSql.query(text, params ?? [])) as T[] };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    let db: InstanceType<typeof PGlite>;
    if (process.env.VITEST || offline()) db = new PGlite();
    else {
      // FRONT_ROOM_PGLITE_DIR: a second local server (QA next to dev) needs its own folder: PGlite has one writer.
      const { mkdirSync } = await import("node:fs");
      const dir = process.env.FRONT_ROOM_PGLITE_DIR || `${process.cwd()}/.data/pglite`;
      mkdirSync(dir, { recursive: true });
      db = new PGlite(dir);
    }
    sql = { query: async <T,>(text: string, params?: unknown[]) => (await db.query<T>(text, params ?? [])).rows };
  }
  await migrate(sql);
  return sql;
}

export function db(): Promise<Sql> {
  store.__frontRoomDb ??= open().catch((e) => {
    store.__frontRoomDb = null;
    throw e;
  });
  return store.__frontRoomDb;
}
