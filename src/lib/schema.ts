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
-- Databases made before the log covered films and places had "track_ref": add the new column (old rows keep theirs).
ALTER TABLE responses ADD COLUMN IF NOT EXISTS item_ref text;

-- People: one document per person (their confirmed story). The id is the private link.
CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY,
  person jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The people each device looks after: those it created, or opened from a link.
CREATE TABLE IF NOT EXISTS device_people (
  device_id text NOT NULL,
  person_id text NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, person_id)
);

-- A person's kits, for the learning across sessions.
ALTER TABLE kits ADD COLUMN IF NOT EXISTS person_id text;
CREATE INDEX IF NOT EXISTS kits_person ON kits (person_id, created_at);

-- What was played for a person from their gallery, and how they responded. The item key is the same thing across
-- suggestions however it was spelled (src/lib/learning.ts itemKey); type, title and artist are kept for display.
CREATE TABLE IF NOT EXISTS plays (
  id serial PRIMARY KEY,
  person_id text NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_type text NOT NULL,
  title text NOT NULL,
  by_name text,
  response text NOT NULL, -- calm | engaged | sang | upset | none
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plays_person ON plays (person_id, at);

-- Rate-limit and budget counters, one row per key and window.
CREATE TABLE IF NOT EXISTS usage (bucket text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL);
`;
