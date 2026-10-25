import "server-only";
import { neon } from "@neondatabase/serverless";
import { migrate, type Sql } from "@/lib/migrate";
import { env } from "@/server/env";

/**
 * The database: Neon (Vercel integration) when DATABASE_URL is set, else PGlite in .data/ for local development (and
 * in memory under tests). The schema is created on first use, through the same driver production uses.
 */
let ready: Promise<Sql> | null = null;

async function open(): Promise<Sql> {
  let sql: Sql;
  if (env.DATABASE_URL) {
    const neonSql = neon(env.DATABASE_URL);
    sql = { query: async <T,>(text: string, params?: unknown[]) => (await neonSql.query(text, params ?? [])) as T[] };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = process.env.VITEST ? new PGlite() : new PGlite(`${process.cwd()}/.data/pglite`);
    sql = { query: async <T,>(text: string, params?: unknown[]) => (await db.query<T>(text, params ?? [])).rows };
  }
  await migrate(sql);
  return sql;
}

export function db(): Promise<Sql> {
  ready ??= open().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
