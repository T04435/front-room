# Front Room · demo script (offline, no API spend)

Run it with mock data (Qloo fixtures and mock models; only MusicBrainz, which is free, is called):

```bash
FRONT_ROOM_OFFLINE=1 NEXT_DIST_DIR=.next-qa pnpm exec next dev -p 3520
```

Open http://localhost:3520. Use a fictional person.

## 1. A new person: the chat (about 60 s)
1. **People → Add someone.** Name "Iris". Consent: Family, They agreed. **Start their story.**
2. The Go-Between explains what helps (the "This is me" themes as chips). Tap **Talk** or paste:
   > Iris was born in 1946 and grew up in Liverpool. She married in '68 and moved to Leeds. Her brother Tom died and
   > she never talks about him. She loved Cilla.
3. **Here's what I heard**: born 1946, Liverpool 1946–68, Leeds from 1968, married 1968, loves Cilla. Edit or remove
   any; **All right**.
4. "You mentioned Brother Tom. Shall I steer clear?" → **Never** (only the label is kept, never the reason).
5. It digs in: "You said they moved to Leeds. What did they do there?"
6. **Find things for Iris**: the Qloo look-up streams in the chat, place by place and era by era, then **Open Iris's
   gallery**.

## 2. The gallery: what to play now (about 45 s)
1. **Before you start**: the 30-second handover for whoever's on shift (what works, avoid, talk about, settles with).
   The pitch: a new carer knows what works for Iris before they walk in.
2. Shelves: New tries, Songs (checked on MusicBrainz), Films, On the telly, Places they knew. Each has a source line;
   the family's own picks come first.
3. Tap a song → Spotify or YouTube (nothing hosted) → **Sang along**. Undo is there. **Tearful** is its own response
   (a good cry isn't distress; tearful on two days pauses it for the family to answer).
4. **Learned something new?** → A place → "Talked about the Cavern Club" → Save.
5. Tap another → **Stop · something calm instead**: logs the upset, pauses the item, and opens something calm with
   the basics to check first (pain, hungry or thirsty, toilet, too hot or cold).
6. **Something calm now** at the top: one tap in a hard moment.

## 3. It learns (about 45 s)
1. **Get to know Iris better**: "Upset during … : steer clear?", and the staff-heard note to confirm.
2. The example **Margaret** (`/p/margaret-x`): five days of play. Works for Margaret (Waterloo, Dusty), three new tries
   like what works, Yesterday paused, Lola resting.
3. **What works**: the 30-second handover card for the 18:00 shift, with the care note.

Notes (what we claim, and don't):
- Say: "engagement and connection, logged by staff", "personal music beats generic". Never "reduces agitation" or
  "reduces antipsychotics": the Cochrane review found little effect on agitation over time (see the research note).
- The problem: a stranger at 18:00 who doesn't know the person (about 25% staff turnover, short handovers). No one
  else learns shift by shift what works.
- Qloo gets places and years, never names or steer-clear topics.
