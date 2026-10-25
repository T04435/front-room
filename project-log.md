# Project log (DEV)

Qloo Agentic Hackathon 2026, 4th entry: **Front Room** (renamed from the working slug "music-care" on 25 Oct; the
brand comes from the Front Room design system).
Devpost deadline 30 Oct 2026, 23:45 ET. Newest first.

## 2026-10-25 · Renamed to Front Room (HQ)

- **Outside the repo (HQ):** GitHub is T04435/front-room (the old name redirects; origin is updated). The Vercel
  project is front-room (same id) at https://front-room.vercel.app, with PRODUCTION_URL updated. The local folder is
  `~/projects/CUBANOSDEV/hackathon-projects/front-room/front-room`, with a symlink at the old path.
- **In the repo:**
  - the package name, README, `APP_NAME = "Front Room"` (page title and metadata) and the repo links;
  - the NotOnQ app paths: `/q/app/front-room` on Vercel, `/q/app/front-room-dev` locally;
  - env vars `MUSIC_CARE_*` → `FRONT_ROOM_*` (offline mode, limits);
  - the device cookie `mc_device` → `fr_device`.
  Entries below keep the old names as they were then.

## 2026-10-25 · Vercel (HQ)

- **Done:** the Vercel project music-care (prj_xcUR1zKmWfJHcMTuMlD2TOiGfZFZ), with the Next.js preset and
  autoExposeSystemEnvs. Repo variables VERCEL_ORG_ID, VERCEL_PROJECT_ID and PRODUCTION_URL=https://music-care.vercel.app.
  A QLOO_API_KEY placeholder is set in every environment.
- **Pending:**
  - Neon via the integration, waiting on the user's OK.
  - The user's own steps: the VERCEL_TOKEN secret, AI_GATEWAY_API_KEY locally, and Neon preview branching.
- **No preview yet for PR #1.** The PR predates the project, so the next real push builds the first preview. No
  push just to trigger it.

## 2026-10-25 · Scope: reminiscence, not only music (the user, via HQ)

- **"music care" is only a working slug.** The kit is reminiscence across what Qloo knows about someone's youth.
- **Generic items.** Kit items are now one shape, `KitItem {type: song | artist | film | tv | place | book | family,
  title, year, source, why, via}`, with refs S/A/F/T/P/B/K. The playlist is just the kit's songs, never a separate
  table. Responses log an `item_ref`: a song, a film or a place.
- **Places.** A new run step asks Qloo for places tagged `urn:tag:ambience:qloo:historic` with `filter.location.query`.
  Live for Manchester: Palace Theatre, the Ritz, Old Trafford, Central Library, the Midland. Qloo's places are
  today's, so the kit says "likely there in their youth too". The curator picks 1–3 places and 2–3 films or TV shows
  to talk about, each with a `why`.
- **Books are out for now.** `filter.publication_year` returns editions and reprints (Marvel omnibuses for
  1965–75), so books are in the model but not researched.
- **Naming.** UI copy says "session kit". The on-screen name is a placeholder (`APP_NAME = "Session Kit"` in
  `src/lib/app.ts`) until the brand lands. No files or routes are named "music…". The repo and package stay
  `music-care` until the rename.
- **V2 MCP App is on ROADMAP.md, out of MVP scope.** `KitView` takes props only, so the widget can reuse it.

## 2026-10-25 · MVP first pass (branch feat/mvp)

**State:** the whole MVP flow runs locally on :3500. Offline mode (fixtures) is tested end to end in unit tests and
Playwright. Live Qloo was probed through NotOnQ, and the shapes match the parsers. The live end-to-end demo still needs
`AI_GATEWAY_API_KEY` in `.env.local`: the curator step calls the model.

**Built:**
- **Qloo client** (`src/lib/qloo-transport.ts`): NotOnQ's drop-in API first, with a 4 s budget. Any error, non-2xx
  or timeout retries the same request against `hackathon.api.qloo.com`, and the call is marked as fallen back.
  Results are cached for 24 h, and direct calls are paced 220 ms apart. The fallback is unit-tested.
- **Run** (`src/server/run.ts`), streamed as NDJSON, each step with its sources:
  1. find the place;
  2. the decade tags for ages 15–25;
  3. in parallel: era artists around the place, the family's likes (with similar era artists), films and TV by
     release year;
  4. an inline question when Qloo comes back empty;
  5. the curator builds the playlist and prompts, which are checked against the research.
- **Kit:** 7 tracks ordered calm → familiar → singalong, with Spotify and YouTube search links (no media hosted),
  5–6 prompts with inline citations, an AI-generated label, a no-treatment note, and the research list showing
  NotOnQ or Qloo direct for each source.
- **Response log:** one tap for calm, engaged, sang along or upset, tied to the track playing, with undo.
- **Saved kits:** `/kits` lists this browser's kits (device cookie). `/kits/<id>` is a public share link, no login.
- **DB:** Neon through `DATABASE_URL`, or PGlite in `.data/` locally (in memory offline). The schema runs one
  statement at a time, and a test drives a Neon-like driver that rejects multi-statement text.
- **Limits:** per-device and per-network hourly limits, plus daily run and Qloo budgets. All are env vars, and a
  judging-day switch exists (`MUSIC_CARE_LIMITS_OFF_UNTIL` or the `settings` row). A refused run points to saved kits.
- **Standards:** commitlint + simple-git-hooks, `vercel.json` (framework nextjs, main deploys off), the version badge
  and `/api/version`, and GhostQ's `release.yml` and `.releaserc.json`.

**Decisions taken without asking (defaults):**
- **NotOnQ keys and base (confirmed by HQ, 25 Oct).** NotOnQ issues no keys, so the same `QLOO_API_KEY` serves the
  NotOnQ path and the direct fallback. The app names itself in the base URL: `https://notonq.vercel.app/q/app/music-care`
  on Vercel (previews and production), and a local NotOnQ at `http://localhost:3400/q/app/music-care-dev` in
  development, to save Vercel function time (the user's call). `NOTONQ_BASE_URL` overrides both. If local NotOnQ is
  down, the Qloo fallback keeps dev working. `NOTONQ_DISABLED=1` goes
  direct. Today NotOnQ fills gaps for artists only; films, TV and tags pass through to Qloo.
- **Research is fixed steps, not tool calls the model picks.** Every later step depends on the place and the
  decade tags, and fixed steps are fast and cheap for a judging room. The model is the curator: it picks songs,
  orders them and writes the prompts. GhostQ also runs its "read the crowd" steps as fixed steps.
- **Song titles are the model's picks** for Qloo-sourced artists, and the kit labels them so. Qloo has no song
  entities, and albums ignore year and place. Verifying titles through MusicBrainz is a follow-up.
- **The place goes to `signal.location.query` as typed** ("Manchester" was verified live and leans UK). The
  shown label comes from Qloo's locality search ("Manchester, United Kingdom").
- **Saved-kit owners are a device cookie, not accounts.** The live URL works without login, and share links are
  unguessable 10-character ids.
- **The demo person is fictional:** Margaret, born 1950, Manchester, who likes Dusty Springfield.
- **Production smoke URL:** `release.yml` reads the repo variable `PRODUCTION_URL` and falls back to
  `https://music-care.vercel.app`. Set it once the domain is known.

**Live probe (25 Oct, about 8 calls through NotOnQ, all passed through to Qloo, under 1 s each):**
- Manchester 60s: the Beatles, the Kinks, the Who, Otis Redding, the Zombies, plus noise (Twiggy, Yolanda).
- Manchester 70s: ABBA, Rod Stewart, ELO, Donna Summer, plus noise (Snoopy, Badger).
- Films 1965–75: The Sound of Music, The Jungle Book, The Godfather, Papillon.
- TV: Film '72 and The Old Grey Whistle Test (thin, hence the no-place fallback).

**Next:**
- Run the live Margaret demo once the AI Gateway key is in.
- Family corrections ("not for her" on a track, then rebuild with `avoid`; the API already takes it).
- MusicBrainz check of song titles.
- The brand from the BRAND session.
- An example kit on `/kits` for judges.
