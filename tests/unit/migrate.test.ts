import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { migrate, type Sql } from "@/lib/migrate";
import { SCHEMA } from "@/lib/schema";
import { splitSql } from "@/lib/sql-split";

/**
 * Behaves like Neon's driver on the point that bit NotOnQ in production: one statement per call, or it throws
 * "cannot insert multiple commands into a prepared statement".
 */
function neonLike(): Sql & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    async query<T>(text: string) {
      const stripped = text.replace(/'[^']*'/g, "''");
      if (stripped.replace(/;\s*$/, "").includes(";")) throw new Error("cannot insert multiple commands into a prepared statement");
      if (/--|\/\*/.test(stripped)) throw new Error("comment reached the driver");
      seen.push(text);
      return [] as T[];
    },
  };
}

describe("splitSql", () => {
  it("drops comments before splitting, so `; -- note` can't glue two statements", () => {
    expect(splitSql("CREATE TABLE a (x int); -- first\nCREATE TABLE b (y int); /* two */ SELECT 1")).toEqual(["CREATE TABLE a (x int)", "CREATE TABLE b (y int)", "SELECT 1"]);
  });
  it("keeps semicolons and dashes inside quotes", () => {
    expect(splitSql("INSERT INTO t VALUES ('a;b -- c'); SELECT 2;")).toEqual(["INSERT INTO t VALUES ('a;b -- c')", "SELECT 2"]);
  });
});

describe("migrate", () => {
  it("sends the schema through a Neon-like driver one statement at a time", async () => {
    const sql = neonLike();
    const n = await migrate(sql);
    expect(n).toBe(sql.seen.length);
    expect(n).toBeGreaterThanOrEqual(6);
  });

  it("brings an older database up to date (responses with track_ref, kits without person_id)", async () => {
    const db = new PGlite();
    const sql: Sql = { query: async <T,>(text: string, params?: unknown[]) => (await db.query<T>(text, params ?? [])).rows };
    await sql.query("CREATE TABLE kits (id text PRIMARY KEY, owner text, kit jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE TABLE responses (id serial PRIMARY KEY, kit_id text NOT NULL REFERENCES kits (id) ON DELETE CASCADE, response text NOT NULL, track_ref text, at timestamptz NOT NULL DEFAULT now())");
    await migrate(sql);
    await sql.query("INSERT INTO kits (id, kit, person_id) VALUES ('k', '{}', 'p')");
    await sql.query("INSERT INTO responses (kit_id, response, item_ref) VALUES ('k', 'calm', 'S1')");
    expect(await sql.query("SELECT item_ref FROM responses")).toEqual([{ item_ref: "S1" }]);
  });

  it("creates working tables in Postgres (PGlite), and runs twice without harm", async () => {
    const db = new PGlite();
    const sql: Sql = { query: async <T,>(text: string, params?: unknown[]) => (await db.query<T>(text, params ?? [])).rows };
    await migrate(sql);
    await migrate(sql);
    await sql.query("INSERT INTO kits (id, owner, kit) VALUES ('k', null, '{}')");
    await sql.query("INSERT INTO responses (kit_id, response) VALUES ('k', 'sang')");
    expect(await sql.query("SELECT response FROM responses")).toEqual([{ response: "sang" }]);
    expect(SCHEMA).toContain("CREATE TABLE IF NOT EXISTS kits");
  });
});
