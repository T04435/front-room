/** The database schema, run statement by statement (src/lib/sql-split.ts) at first use. Kept in code, not a file read at
 * runtime, so it ships with the build. */
export const SCHEMA = `
-- Saved session kits. "kit" holds only what the page shows (no raw Qloo responses).
CREATE TABLE IF NOT EXISTS kits (
  id text PRIMARY KEY,
  owner text,
  kit jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kits_owner_created ON kits (owner, created_at DESC);

-- One-tap responses logged during a session; "item_ref" is what was on (a song playing, a film talked about), if any.
CREATE TABLE IF NOT EXISTS responses (
  id serial PRIMARY KEY,
  kit_id text NOT NULL REFERENCES kits (id) ON DELETE CASCADE,
  response text NOT NULL, -- calm | engaged | sang | upset
  item_ref text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS responses_kit ON responses (kit_id, at);

-- Rate-limit and budget counters, one row per key and window.
CREATE TABLE IF NOT EXISTS usage (bucket text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL);
`;
