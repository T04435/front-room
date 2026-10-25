# Roadmap

## V1: MVP (today, 25 Oct 2026)
- A birth year and hometown go in. The run researches the music, films, TV and places of the years they were 15 to 25.
- Out comes a cited session kit: playlist, films, TV and places to talk about, prompts, a one-tap response log, and saved, shareable kits.
- Then the brand from the BRAND session, and a rename from the working slug "music-care".

## V2: an MCP App (planned 27–28 Oct, about 1 day, after the MVP and the brand port). Out of scope for the MVP.
The official MCP UI extension (`io.modelcontextprotocol/ui`, stable since 26 Jan 2026) renders in Claude and ChatGPT.
- **One `/mcp` route:** built with `mcp-handler` and `@modelcontextprotocol/ext-apps`, starting from Vercel's "MCP Apps Next.js starter".
- **One tool:** `make_session_kit(birth_year, hometown, likes?)`, running the same research pipeline (NotOnQ first, with the direct-Qloo fallback).
- **One `ui://` widget:** renders the session kit card, reusing the app's kit components. They're kept self-contained for this: `KitView` takes the kit by props and has no page coupling.
- **Testing:** on a Vercel preview or production URL, as a custom connector in Claude and in ChatGPT developer mode. No ChatGPT directory submission.

## Later
- **Family corrections:** "not for them" on any item, then rebuild with `avoid` (the API already takes it).
- **Song titles:** check against MusicBrainz.
- **Books by era:** Qloo's publication years are editions today, so books are in the item model but not researched.
- **An example kit on `/kits` for judges.**
