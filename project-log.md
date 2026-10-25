# Project log (DEV)

Qloo Agentic Hackathon 2026, 4th entry. Working name "music care" (the name and brand come from the BRAND session).
Devpost deadline 30 Oct 2026, 23:45 ET. Newest first.

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
- **NotOnQ keys.** NotOnQ has no keys of its own (per NotOnQ's log). The client sends our `QLOO_API_KEY` to NotOnQ
  and names the app in `X-NotOnQ-App`: `music-care` on production, `music-care-dev` elsewhere, so its ledger shows
  dev traffic apart. `NOTONQ_API_KEY` overrides the key if NotOnQ starts issuing them. `NOTONQ_DISABLED=1` goes
  direct.
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
