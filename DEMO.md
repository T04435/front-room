# Front Room · demo script (offline, no API spend)

Run it with mock data (Qloo fixtures and mock models; only MusicBrainz, which is free, is called):

Present from the production build (no dev overlay, frozen code):

```bash
FRONT_ROOM_OFFLINE=1 NEXT_DIST_DIR=.next-demo FRONT_ROOM_PGLITE_DIR=.data/pglite-demo sh -c "pnpm exec next build && pnpm exec next start -p 3530"
```

Open http://localhost:3530 (or the launch config `front-room-demo`). Use a fictional person. Offline data lives in
memory: a restart starts empty, apart from the example Margaret.

Before you present:
- Rehearse once on the presenting device. Copy buttons fall back to a copy box where the clipboard is blocked.
- Offline, don't answer the "What did they do there?" follow-up live; the mock reads only "worked in/at/as …".
- Keep to UK towns offline (the mock has no data for, say, Lahore; live Qloo does). Use Joan, Iris or Margaret.

## The 30-second version (for the video)

Fictional Joan, on the production build, mock data. Paste (or say) exactly this; the offline reader understands it:

> Joan was born in 1946 and grew up in Liverpool. She danced at the Cavern every Saturday and loved Cilla Black.
> She married in '68 and moved to Leeds. Her brother Tom died young.

| Time | On screen | Voice-over |
|---|---|---|
| 0–5s | People → Add someone (Joan) → the chat → paste. | "Care homes write life stories, then never use them." |
| 5–10s | Here's what I heard → All right. Steer clear of brother Tom → Never. Language → English. Find things for Joan. | "Front Room starts with the family's own words." |
| 10–16s | The look-up streams; Open Joan's gallery. Start here: Cilla Black (from the family), a new try, the Cavern Club (from their story). No war films. | "Qloo turns where and when they grew up into the songs, films, TV and places of their youth." |
| 16–23s | Tap a song: the hook ("Out in 1963, when Joan was 17 and living in Liverpool"), the prompt, Sang along. A film shows "Play the song from it". | "Every card says what to say. One tap logs how it went." |
| 23–30s | The example Margaret: Before you start (For staff) → What works. | "And what works stays, for whoever's on next." |

## 1. A new person: the chat (about 60 s)
1. **People → Add someone.** Name "Iris". Consent: Family, They agreed. **Start their story.**
2. The Go-Between explains what helps (the "This is me" themes as chips). Tap **Talk** or paste:
   > Iris was born in 1946 and grew up in Liverpool. She married in '68 and moved to Leeds. Her brother Tom died and
   > she never talks about him. She loved Cilla Black.
3. **Here's what I heard**: born 1946, Liverpool 1946–68, Leeds from 1968, married 1968, loves Cilla Black. Edit or remove
   any; **All right**.
4. "You mentioned Brother Tom. Shall I steer clear?" → **Never** (only the label is kept, never the reason).
5. It digs in: "You said they moved to Leeds. What did they do there?" Then it asks the language they grew up
   speaking (tap English); for anyone else, the handover card shows it with "a few words in it help".
6. **Find things for Iris**: the Qloo look-up streams in the chat, place by place and era by era, then **Open Iris's
   gallery**.

## 2. The gallery: what to play now (about 45 s)
1. **Before you start**: the 30-second handover for whoever's on shift (what works, avoid, talk about, calm with, the comfort checks). It opens **For staff**; **For a visit** is one tap and is remembered on that device, so tap For staff before presenting if you tried it..
   The pitch: a new carer knows what works for Iris before they walk in.
2. Shelves: New tries, Songs (checked on MusicBrainz), Films, On the telly, Places they knew. Each has a source line;
   the family's own picks come first.
3. Tap a song → Spotify or YouTube (nothing hosted) → **Sang along**. Undo is there. **Tearful** is its own response
   (a good cry isn't distress): the card is marked "Ask family", and the chat asks them to keep it or steer clear.
4. **Learned something new?** → A place → "Talked about the Cavern Club" → Save.
5. First log **Calm** on one song (so Stop has something proven to open). Then tap another → **Stop · something calm instead**: logs the upset, pauses the item, and opens something calm with
   the basics to check first (pain, hungry or thirsty, toilet, too hot or cold).
6. **Something calm now** at the top: one tap in a hard moment.

## 3. It learns (about 45 s)
1. **Get to know Iris better**: "Upset during … : steer clear?" (or "was tearful during … keep it?"), and the staff-heard note to confirm.
2. The example **Margaret** (`/p/margaret-x`): five days of play. Works for Margaret (Waterloo, Dusty), three new tries
   like what works, Yesterday paused, Lola resting.
3. **What works**: the 30-second handover card for the 18:00 shift, with the care note.

Notes (what we claim, and don't):
- Say: "engagement and connection, logged by staff", "personal music beats generic". Never "reduces agitation" or
  "reduces antipsychotics": the Cochrane review found little effect on agitation over time (see the research note).
- The problem: a stranger at 18:00 who doesn't know the person (about 25% staff turnover, short handovers). No one
  else learns shift by shift what works.
- Qloo gets places and years, never names or steer-clear topics.
