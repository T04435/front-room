# Front Room

**What works for them, handed to whoever's on next.**

## Inspiration

It's 18:00 in a care home. The person on shift may be new, or from an agency, and has never met the woman in the
front room. They don't know she danced at the Cavern every Saturday, that she loved Cilla Black, or that her brother
Tom is never to be mentioned.

That stranger is the real problem, and the numbers back it up:

- Care-home staff turnover in England is about 25% ([CQC, State of Care 2024/25](https://www.cqc.org.uk/publications/major-report/state-care/2024-2025/access/asc)).
- Most care-home handovers last about 15 minutes, in an office, and with 12-hour shifts many homes hold only two a day
  ([KCL, "How do handovers happen?"](https://kclpure.kcl.ac.uk/portal/en/publications/how-do-handovers-happen-a-study-of-handover-at-shift-changeovers-/)).
- A 2025 inspection found one-to-one agency workers who hadn't had a detailed handover and couldn't describe the needs
  of the person they were supporting
  ([RQIA, Oak Tree Manor, April 2025](https://www.rqia.org.uk/download/31/care-home-inspection-reports/1941/12230_oaktreemanornursinghome_care_08-april-2025.pdf)).

The information often exists. Families fill in Alzheimer's Society's
["This is me"](https://www.alzheimers.org.uk/get-support/publications-factsheets/this-is-me) form: where someone grew
up, the people and places that matter, what they like. But it's used unevenly. A study of healthcare staff found that
completion, where the form is kept and whether it's used consistently were the recurring problems
([Baillie & Thomas 2020](https://oro.open.ac.uk/54914)), and
[Healthwatch Southampton](https://nds.healthwatch.co.uk/node/770915) said it "needs to be consistently utilised".
The form is filled in, then sits in a folder. It isn't in the carer's hand at the moment it's needed, and it never
records whether anything actually worked.

## What it does

Front Room turns a family's story into a gallery of songs, films, telly and places from someone's youth, tells staff
what to say about each one, and learns from one-tap logs what works for that person.

1. **Add someone.** A consent card records who is telling the story and whether the person agreed. Three fictional
   "This is me" examples are ready to try: Joan (Liverpool, then Leeds), Rosa (Sevilla, then Madrid, written in
   Spanish) and Amrit (born in Lahore, grew up in Amritsar, then Bradford, who grew up speaking Punjabi).
2. **Tell their story to the Go-Between.** Type, paste, talk, or take a photo of the paper "This is me" (a PDF works
   too). Each message comes back as **Here's what I heard**, to confirm or correct. Anything painful gets a gentle
   **steer clear?** question, and only a short label is kept, never the reason. Follow-ups dig into the teller's own
   words, in their own language, and it asks for what's missing, including the language they grew up speaking.
3. **Find things.** Qloo looks up each place they lived, in the years they were about 10 to 30 there: the artists of
   that decade around that town, the films and TV of those years, historic places, and things like what they love.
   The look-up streams into the chat as it goes.
4. **The gallery.** It opens with **Before you start**, a 30-second handover card (For staff, or For a visit): what
   works, what to avoid, what to talk about, what calms them, and the comfort checks first (pain, hungry or thirsty,
   toilet, too hot or cold). Then a **Start here** row of three, and shelves: Works for them, New tries, Songs, Films,
   On the telly, Books, Places. Every card has a hook tied to the person ("Out in 1963, when Joan was 17 and living in
   Liverpool"), an open question and what they might answer. A film offers a song from it; a TV show, its theme tune.
   Everything plays through Spotify or YouTube.
5. **Log it with one tap.** Calm, Engaged, Sang along, Tearful or Upset, with Undo, and a **Stop** button that pauses
   the item and opens something calm instead.
6. **It learns.** Engaged or sang along on two days, and an item is proven: it moves to Works for them. One upset
   pauses it. Tearful isn't the same as upset (a good cry is allowed), so the family is asked whether to keep it.
   Three quiet days rest an item for 30 days. New tries come from Qloo, like what's proven. The **What works** page
   holds the handover card and the care notes for whoever's on next.

## How we built it

- **Next.js 16** (App Router) with **shadcn/ui** and our Front Room design system.
- **AI SDK 7 through the Vercel AI Gateway**, with **Claude Sonnet**. The model has three narrow jobs:
  - read the teller's words into facts, each with a short quote of what they said, plus one or two follow-ups in
    their language;
  - read a photo or PDF of a paper "This is me" into text (leaving out surnames, addresses, diagnoses and medication);
  - pick one well-known song per artist from the right years, because Qloo knows artists, not songs.
- **MusicBrainz** checks every song title as a real recording by that artist before anyone sees it.
- **Postgres** on Neon, or PGlite locally. `FRONT_ROOM_OFFLINE=1` runs the whole app on fixture data and a mock model,
  for tests and rehearsals.

### How we use Qloo

Qloo is the bridge from "where and when" to "what they'd know". For each place in the story, we work out the years
they lived there that fall between ages 10 and 30, then ask Qloo:

- **Era artists around the place:** `/v2/tags` finds the decade's music tag (say, "60s"), then `/v2/insights` with
  `filter.type=urn:entity:artist`, that tag, and `signal.location.query` set to the town.
- **Films and TV:** `/v2/insights` for `urn:entity:movie` and `urn:entity:tv_show` with `filter.release_year.min/max`
  for their years and the town as a location signal. Horror is excluded with `filter.exclude.tags`.
- **Places:** `/v2/insights` for `urn:entity:place` with `filter.location.query` and the
  `urn:tag:ambience:qloo:historic` tag, so the dance halls and theatres of their town come up.
- **Things like what they love:** `/search` finds the artist, film, show or book the family named, and `/v2/insights`
  with `signal.interests.entities` finds more like it (for artists, also from that decade and town).
- **New tries:** once something is proven, the same "more like this" call, seeded by what works, finds the next
  thing to try.
- **Pictures:** card images come from Qloo's entity images.

Every call goes through NotOnQ's drop-in API first, and falls back to Qloo directly after any error or 4 seconds.
Qloo only ever gets places, years and taste entities: never a name, never a steer-clear topic.

## Challenges we ran into

- **The evidence changed our pitch halfway through.** We started with "music calms evening agitation". The trials
  don't support that, so we rebuilt the product around the stranger at 18:00 and a handover card.
- **Era picks are guesses.** Research shows songs picked by era alone often don't cue memories. So Qloo's picks are
  labelled as new tries, the family's own loves go first, and only the logs can make something "Works for them".
- **Qloo knows artists, not songs.** The model picks a song for each artist, and MusicBrainz checks it's real; titles
  it can't find are dropped.
- **Era-correct isn't always right.** Early galleries put The Godfather next to a steer-clear of "loud bangs". Films
  and TV now carry genres, and war and crime are hidden when steer clear points that way.
- **Places came back as universities and research libraries.** We put places from their story first and drop
  institutions unless the family named them.
- **Tears aren't distress.** A Tearful log has to mean something different from Upset, without anyone guessing which
  it was, so we ask the family.

## Accomplishments that we're proud of

- A new carer can read what works for someone in 30 seconds, before they walk in.
- A paper "This is me" can be photographed and read straight into the chat, so the forms already in folders can be
  used.
- It works beyond English: the chat follows up in the teller's language, and the handover card shows the language
  they grew up speaking, with "a few words in it help" when it isn't English.
- Every card says what to say, and none of it is invented: hooks state only the year, their age and the place.
- Calm is never guessed. The handover card only says something calms them when it was logged calm or the family
  said so.
- The whole app runs offline for tests and rehearsals, with no paid calls.

## What we learned

- **The evidence changed our pitch.** The Cochrane review found little or no effect of music therapy on agitation
  over time ([van der Steen et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6513122); its
  [2025 update](https://www.cochrane.org/about-us/news/music-based-therapy-may-improve-depressive-symptoms-people-dementia)
  agrees), and two large trials of personalised playlists found no effect on agitation
  ([METRIcAL](https://clinicaltrials.gov/study/NCT03821844)). So we make no agitation claims. What Front Room offers is
  engagement and connection, logged by staff.
- **Personal beats generic.** Music chosen for the individual did better than generic relaxing music
  ([Gerdner 2000](https://sgec.stanford.edu:443/content/dam/sm/sgec/documents/education/Evidence-Based%20Guidelines_Linda%20Gerdner.pdf)),
  and era songs picked by someone else often don't land
  ([Jakubowski et al.](https://durham-repository.worktribe.com/OutputFile/1280315)). That's why the family's own
  picks come first and the logs decide what works.
- **Personal music can bring sadness**
  ([Garrido et al. 2018](https://researchers.westernsydney.edu.au/en/publications/music-and-dementia-individual-differences-in-response-to-personal/)),
  so steer clear, Tearful and Stop are part of the product, not extras.

## What's next for Front Room

- **A care-home view:** everyone in the home, and what works for each, for the manager and the shift lead.
- **Accounts:** for homes, staff and families, in place of today's device-based access.
- **The app in other languages:** the chat already follows the teller's language; the rest of the app should too.
- **An MCP App:** Front Room's gallery inside Claude and ChatGPT, through the MCP UI extension.
- **A licensing check for images** before Qloo's pictures are shown more widely.

## Built with

Next.js 16 · React 19 · TypeScript · AI SDK 7 · Vercel AI Gateway · Claude Sonnet · Qloo API · NotOnQ · MusicBrainz ·
Postgres (Neon) · PGlite · shadcn/ui · Tailwind CSS · Zod · Vitest · Playwright · Vercel
