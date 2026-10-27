# Front Room

**What works for them, handed to whoever's on next.**

Front Room helps care staff share music, films, telly and places with someone living with dementia, and keeps a
record of what actually went well. A family member (or a key worker) tells the person's story in a chat, the way a
"This is me" form asks for it. Front Room uses [Qloo](https://www.qloo.com) to turn where and when they grew up into
the songs, films, TV and places of their youth. Staff play things from a per-person gallery, log how it went with one
tap, and the gallery learns, shift by shift, what works for that person.

Built for the Qloo Agentic Hackathon 2026.

> Front Room helps you share music and memories. It is not music therapy or a treatment. Watch how they respond and
> stop if they seem upset or overwhelmed.

## What's in it

- **Landing page** at `/`, and **People** at `/people`.
- **Add someone:** a consent card (who is telling the story, and whether the person agreed), plus three fictional
  "This is me" examples to start from:
  - Joan, Liverpool then Leeds;
  - Rosa, Sevilla then Madrid, written in Spanish;
  - Amrit, born in Lahore, grew up in Amritsar, then Bradford, who grew up speaking Punjabi.
- **The chat with the Go-Between.** Type, paste, tap **Talk** (the browser's speech-to-text), or upload a photo or PDF of
  a paper "This is me" to read it into the chat box. Each message gets:
  - a **Here's what I heard** card to confirm, edit or remove facts;
  - a **steer-clear** question for anything painful ("Brother Tom": only the label is kept, never the reason);
  - follow-ups in the teller's own language, grounded in what they said;
  - asks for what's still missing, including the language they grew up speaking.
- **Find things** runs the Qloo look-up, streamed into the chat place by place and era by era. Films, TV and places are
  saved first, so the gallery can open while the songs are still being checked on MusicBrainz; they join it as they land.
- **The gallery**, one per person:
  - **Before you start**, the 30-second handover card, with a **For staff / For a visit** toggle: what works, what to
    avoid, what to talk about, what calms them, the language they grew up speaking, and the comfort checks first;
  - a **Start here** row of three, then shelves: Works for them, New tries, Songs, Films, On the telly, Books, Places;
  - every card has a hook tied to the person ("Out in 1963, when Joan was 17 and living in Liverpool"), an open
    prompt and "they might answer";
  - films offer a song from them, TV offers the theme tune;
  - Spotify and YouTube links only: nothing is hosted.
- **Logging:** Calm, Engaged, Sang along, Tearful or Upset, with Undo, and **Stop · something calm instead** for a hard
  moment.
- **Get to know them better** is the same chat, opening with what's known and what would help next.
- **What works** (`/p/<id>/works`) holds the handover card and the care notes, with a **Print** button for the door or
  the care file.
- A worked example, the fictional **Margaret** (`/p/margaret-x`), with five days of logged plays.

## Quick start

Needs Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
vercel link && vercel env pull .env.local   # writes VERCEL_OIDC_TOKEN for the AI Gateway
pnpm dev                                    # http://localhost:3500
```

`.env.local` needs:

| Variable | What it's for |
|---|---|
| `QLOO_API_KEY` | The Qloo hackathon key. Used for NotOnQ and for the direct Qloo fallback. |
| `VERCEL_OIDC_TOKEN` | AI Gateway auth, from `vercel env pull` on the linked project. It lasts about 12 hours: pull again when model calls start failing. On Vercel it's automatic. `AI_GATEWAY_API_KEY` works as an override. |
| `DATABASE_URL` | Optional. Neon Postgres. Without it, data goes to a local PGlite database in `.data/`. Check that `vercel env pull` didn't write one that points local dev at the shared database. |
| `NOTONQ_BASE_URL`, `NOTONQ_DISABLED` | Optional. Where NotOnQ lives (a local NotOnQ on :3400 by default in development), or `1` to call Qloo directly. |

### Offline mode

```bash
FRONT_ROOM_OFFLINE=1 pnpm dev
```

Fixture Qloo data, a mock model and in-memory storage: nothing paid is called. It's what the tests use, and it's good
for rehearsals. The offline reader understands simple stories (born, grew up in, moved to, loved) and has data for UK
towns; use the Joan, Iris or Margaret stories from `DEMO.md`.

## How it works

```
family's words ──► Go-Between chat ──► confirmed facts ──► Find things ──► gallery ──► one-tap logs ──► what works
  (type, talk,     (Claude Sonnet via    (places, years,     (Qloo per       (cards with  (per item,      (handover card,
   photo, PDF)      AI Gateway)           loves, steer clear)  place × era)   hooks and    per day)        new tries)
                                                                              prompts)
```

- **Next.js 16 App Router.** Pages in `src/app` (`/`, `/people`, `/people/new`, `/p/[id]`, `/p/[id]/story`,
  `/p/[id]/works`); API routes in `src/app/api/people/[id]/…` (`extract`, `read`, `answer`, `research`, `plays`,
  `new-tries`).
- **The model** (Claude Sonnet through the Vercel AI Gateway, AI SDK 7) does three jobs:
  - `src/server/extract.ts`: reads what the teller said into facts, each with a short quote of their own words, plus one
    or two follow-ups in their language. It extracts only: no guessing, no surnames, addresses, diagnoses or medication.
  - `src/server/read-page.ts`: writes out the text of a photo or PDF of a "This is me" (the file isn't kept), leaving
    out surnames, addresses, phone numbers, diagnoses and medication.
  - `src/server/songs.ts`: picks one well-known recording per artist from the right years. Qloo knows artists, not
    songs.
- **MusicBrainz** checks each song title as a recording by its artist (`src/server/musicbrainz.ts`), one call a second.
- **Card words** (`src/lib/card-words.ts`) are written in code, not by the model: the hook states only what's known (the
  year, their age then, the place), and prompts are open and never testing.
- **Learning** (`src/lib/learning.ts`), counted by day per item:
  - Engaged or Sang along on 2 days: **proven** ("Works for them").
  - Upset once: **paused**.
  - Tearful once: the card is marked "Ask family", and the chat asks them to keep it or steer clear. Tearful on 2 days
    with no answer pauses it. Tearful never counts towards proven.
  - No reaction on 3 days and never a good one: **resting** for 30 days.
- **Gallery** (`src/lib/gallery.ts`): the family's own loves first, steer-clear filtering on everything, gentle films
  and TV before harsher ones, and a cap on Places.
- **Storage:** Postgres, on Neon in production or PGlite locally.
- **UI:** shadcn/ui with the Front Room brand.

### The Qloo calls

Every call goes to [NotOnQ](https://notonq.vercel.app)'s drop-in API first (the same paths and shapes as Qloo). On
any error, or after 4 seconds, the same request goes straight to `hackathon.api.qloo.com`
(`src/lib/qloo-transport.ts`). Results are cached for 24 hours.

For each place in their story (up to four per run), the era is the years they lived there that overlap ages 10 to
30 (`src/lib/person.ts`). Then, in `src/server/bell.ts`:

| What | Call |
|---|---|
| The decade's music tag | `GET /v2/tags` with `filter.query` (e.g. "60s") and `filter.tag.types=urn:tag:genre:music` |
| Era artists around the place | `GET /v2/insights`, `filter.type=urn:entity:artist`, `filter.tags=<decade tag>`, `signal.location.query=<place>` |
| Films and TV of the era | `GET /v2/insights`, `filter.type=urn:entity:movie` or `urn:entity:tv_show`, `filter.release_year.min/max`, `signal.location.query`, `filter.exclude.tags=urn:tag:genre:media:horror` (and the same without the place if it comes back thin) |
| Historic places | `GET /v2/insights`, `filter.type=urn:entity:place`, `filter.location.query=<place>`, `filter.tags=urn:tag:ambience:qloo:historic` |
| Things like what they love | `GET /search` for the loved artist, film, show or book, then `GET /v2/insights` with `signal.interests.entities=<its id>` (artists also with the decade tag and the place) |

**New tries** (`src/server/new-tries.ts`) ask Qloo for artists like what's proven (or what the family loves), with the
decade tag and their home town as signals, and each song is checked on MusicBrainz. Card pictures come from Qloo's
entity images.

## Tests

```bash
pnpm test        # unit tests (Vitest): era, extraction, gallery, learning, Qloo transport, song check, story…
pnpm test:e2e    # Playwright, against its own offline server: no paid calls
pnpm lint && pnpm typecheck
```

The e2e run starts a server in offline mode on its own port and refuses to run against one that isn't offline.

## Privacy and safety

- **Qloo gets places and years, never names.** It gets taste entities (an artist they love) but never steer-clear
  topics.
- **The model sees the story.** The teller's words go to Claude through the AI Gateway to be read into facts. A
  photo or PDF is read and not kept.
- **Data minimisation:** first or preferred name only. No surnames, addresses, diagnoses or medication are extracted,
  and steer-clear keeps a short label, never the reason.
- **Consent first:** the consent card records who is telling the story and whether the person agreed.
- **Steer clear filters everything.** War, crime and similar films and TV are hidden when steer clear points that way.
  Horror is always left out.
- **Never the word "remember"**, in any language: prompts ask what they did, liked or felt.
- **Calm is never guessed.** "Calm with" on the handover card shows only what was logged calm or what the family said.
- **No medical claims** anywhere in the app.
- **Nothing hosted:** music and clips open in Spotify or YouTube. In the UK, playing music in a business usually needs
  a licence; check with your home (this isn't legal advice).

## What we claim, and don't

Say "engagement and connection, logged by staff" and "personal music beats generic". Never say it "reduces
agitation" or "reduces antipsychotics": the Cochrane review found little or no effect on agitation over time, and the
Music & Memory trials found none. The problem Front Room works on is a stranger at 18:00 who doesn't know the person
(care-home staff turnover in England is about 25%, and handovers are short), and that no one else learns, shift by
shift, what works. See `DEMO.md`.

## Licence

MIT. See [LICENSE](LICENSE).
