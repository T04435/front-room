# Project log (DEV)

Qloo Agentic Hackathon 2026, 4th entry: **Front Room** (renamed from the working slug "music-care" on 25 Oct; the
brand comes from the Front Room design system).
Devpost deadline 30 Oct 2026, 23:45 ET. Newest first.

## 2026-10-27 · Brand, landing page and the last features before the submission

- **Brand:** the Front Room design system is ported from feat/brand: tokens, fonts, logo, header and footer, and the
  Go-Between's mark. There's a landing page at `/`; People moved to `/people`.
- **Examples:** three fictional "This is me" stories in the full form (Joan; Rosa, in Spanish; Amrit, born in Lahore
  and grown up in Amritsar). They're one tap from the landing page. The chat reads Spanish, and follow-ups come in the
  teller's language.
- **Pictures:** real pictures from Qloo on every tile (URLs only); older galleries get theirs once.
- **New:**
  - read a photo or PDF of a paper "This is me" (about 4 s live; nothing stored);
  - print the handover card;
  - the gallery opens as soon as films, TV and places are in, and songs follow with `after()`;
  - "a few words" in the language they grew up speaking.
- **Removed:** the v1 kit builder.
- **QA pass 5 (brand):** fixed the phone chat width, focus rings, a sticky Stop button and the remaining phone layout
  issues. Still open, offline only: the mock data has no Spanish or Punjabi music and no pictures. Live works: checked
  with Rosa and Amrit.
- **Docs:** README rewritten; `DEVPOST.md` drafted.
- **Waiting for the user:** the push of `feat/mvp` (the permission check blocked it), merging to `main` for
  production, and the video.

## 2026-10-27 (early) · Overnight loop result: product-v2.5.1, features frozen for the 18:00 demo

- **Tags (local, none pushed):**
  - `product-v2.0`: chat, then gallery.
  - `v2.1`: Talk, Learned something, realistic offline data.
  - `v2.2`: handover first, the family's songs, Tearful, QA pass 1.
  - `v2.3`: Product PR-1..9 (gentle films, a hook and prompt on every card, film songs, places from the story, Start
    here), QA pass 2.
  - `v2.4`: Product PR-10..12a (first language, Tearful asks the family, staff/visit card), QA pass 3.
  - `v2.5`: QA pass 4, features frozen.
  - `v2.5.1`: rehearsal fixes.
- **QA:** four passes. QA pass 4 found 0 blockers. Product signed off v2.4 and froze features.
- **Rehearsal:** the 30-second Joan script (`DEMO.md`) ran on the production build: Cilla Black from the family
  first, a new try, the Cavern Club from her story, the staff card, no war films.
- **For the user to decide:**
  - pushing `feat/mvp`;
  - a few live Qloo calls to check non-UK places and record the video;
  - pictures on cards (Qloo images, licensing).

## 2026-10-26 (night) · Overnight loop: research and QA, product-v2.1 → v2.2 (the user: no pushes, mock data only)

The user asked for a loop until the demo on 27 Oct at 18:00: check the build against the product, align with Product
and QA, research the industry, rebuild, repeat. A local git tag for each version (`product-v2.N`), no pushes until
the user confirms, offline data only. The notes are in the shared side-session folder: `front-room-loop.md`, `-dev`,
`-qa`, `-research`.
- **v2.1:**
  - "Find things" from the start of the chat;
  - Talk (speech to text);
  - "Learned something?" after a play;
  - calm items first after 17:00, and Wake Lock while playing;
  - offline fixtures that read true (real songs, films by year, places by town).
- **Research (Cochrane 2018/2025, the Music & Memory trials, CQC findings) changed the pitch.** Personal music doesn't
  reduce agitation over time, so we never claim it. The real problem is a stranger at 18:00 who doesn't know the
  person, and nobody else learns shift by shift what works.
- **v2.2:**
  - the handover card first;
  - the family's named artists as songs, first on the shelf;
  - a Tearful response;
  - a basics check when settling.
  - It also fixes all 8 majors from QA pass 1: calm never guessed, chat answers in order, artist loves, confirmed
    staff-heard notes, phone chat, duplicate asks, the dev badge and version pill, offline follow-ups. Most minors
    are fixed too.
  - The v1 `/quick` and `/kits` pages redirect to People.
  - `DEMO.md` is the 3-minute offline script.
- Product's session didn't pick up the brief overnight, so DEV ran QA and research as its own subagents.

## 2026-10-26 · Rebuilt around the person: a chat, then a gallery (the user)

The session model (Settle, Chat, Sing; a kit per session) was wrong. What's found is per person, and a session is
only a point in time that adds what was logged. The product is now:
- **A new person: the page is a chat.** The Go-Between explains what helps (the "This is me" themes as chips). The
  family talks, types or pastes. Each message is answered with "Here's what I heard" to confirm, and a follow-up that
  digs into their words ("You said she always sang along to Abba. Which songs?"). Once the minimum is in, it offers
  once to find things, and the Qloo look-up streams inside the chat, then opens the gallery.
- **A person with things found: the page is a gallery.** Shelves of songs, films, TV, books and places ("Works for
  them", "New tries", then by type). A tap opens a sheet: Spotify or YouTube (nothing hosted), and Calm, Engaged,
  Sang along or Upset, with Undo and Stop. Logs are `plays` on the person, by item. The rules are the same (proven
  after 2 good days, paused after an upset, resting after 3 days of nothing), and the shelves update on each log.
- **Get to know them better** is the same chat, opening with what's known and what would help next (including
  "Upset during X: steer clear?").
- **New tries** come from Qloo, like what's proven (or the loved artists), checked on MusicBrainz.
- Removed: the Ring a bell deck (its cards land in the gallery with Loved it and Not for them), session mode, the
  goal buttons and per-session kits for people. Saved kits at `/kits` stay.
- Live check on :3500 (fictional Margot, born 1950, Manchester then Blackpool): chat, look-up in the chat (29
  things, songs checked), gallery, log, Undo, Stop pausing the item, the paused question in the chat, What works.
- The e2e tests still describe the session model; they're rewritten before the next push.

## 2026-10-25 · Next list done: MusicBrainz check, family corrections, example kit

- **MusicBrainz check.** Each song title the curator picks is looked up as a recording by its artist, one call a
  second, with retries on 503. Titles it can't find are dropped while five or more songs remain. Confirmed songs
  keep the curator's year (MusicBrainz's search ranks reissues), and unchecked ones are marked on the kit. Live: 8 of
  8, then 7 of 8, confirmed. The run is now about 25–31 s.
- **Family corrections.** Every song, film, TV show and place gets a "Not for them" toggle. "Build again without
  these" leaves them out of the research and the curator's picks, as a new kit; the original stays. It works from
  the run page and from a saved kit (`/?from=<id>&avoid=…`). The marks carry over on `kit.brief.avoid`.
- **Example kit.** `/kits/example` and the top card on `/kits` show a real run (25 Oct) for the fictional Margaret.
  It's committed as `src/lib/example-kit.ts` without Qloo entity ids, read-only (the log API returns 403), and opens
  without the database.
- **Curator rules.** Prompts never use the word "remember". Staff lines use the person's name or "they", never a
  pronoun guessed from the name (the live run had guessed "she" from "Margaret").

## 2026-10-25 · Live demo verified (Margaret, born 1950, Manchester, likes Dusty Springfield)

- **Run:** about 26 s, 11 live Qloo calls, all through local NotOnQ (no fallbacks needed), the curator on Sonnet 5.5
  via OIDC, no curator problems.
- **Playlist:** Dream a Little Dream of Me (Cass Elliot) → Ain't No Sunshine → Son of a Preacher Man → Massachusetts →
  Maggie May → Hey Jude → Waterloo.
- **Picks:** Fawlty Towers, Monty Python's Flying Circus, the O2 Ritz ("a dance venue since the 1920s"), and the
  Palace Theatre.
- **Prompts:** six, open and non-testing, mixing music, TV and places.
- **Noise:** Qloo's 70s list around Manchester includes Snoopy, Twiggy and Yolanda. The curator ignores them, but
  they show in the research steps.
- **Inline question:** checked live for an unknown town ("Qwxzton" → asks for a bigger town nearby).

## 2026-10-25 · AI Gateway auth: OIDC, no API key (HQ)

- **Same as Busk Map, GhostQ and NotOnQ.** Local dev uses the `VERCEL_OIDC_TOKEN` from `vercel env pull` on the
  linked project. It lasts about 12 h, so pull again to refresh. `env.ts` already accepts it, and on Vercel it's
  automatic. `AI_GATEWAY_API_KEY` stays an optional override. `.vercel/` is gitignored.

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
  - The user's own steps: the VERCEL_TOKEN secret and Neon preview branching.
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
