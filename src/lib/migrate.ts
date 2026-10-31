import { SCHEMA } from "./schema";
import { splitSql } from "./sql-split";

/** The one query method both drivers share (Neon's `sql.query`, PGlite's `db.query` adapted). */
export type Sql = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> };

/** Creates the tables, one statement per call, in order. Idempotent (IF NOT EXISTS throughout). */
export async function migrate(sql: Sql, schema = SCHEMA): Promise<number> {
  const statements = splitSql(schema);
  for (const statement of statements) await sql.query(statement);
  return statements.length;
}
