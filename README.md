# Front Room

Reminiscence session kits for people living with dementia, built for carers and families. Enter a birth year and
where someone grew up. A live research run works out the music, films, TV and places of the years they were 15 to 25
in that place, using Qloo taste data. It then builds a session kit:
- a 20-minute playlist ordered calm → familiar → singalong, opening in Spotify or YouTube;
- films, TV and hometown places to talk about;
- conversation prompts for staff;
- a one-tap response log.

Every item cites its source. Kits are AI-generated suggestions for engagement, not treatment. See ROADMAP.md for
what's next.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3500
```

`.env.local` (see `.env.example`) needs:
- `QLOO_API_KEY`;
- `VERCEL_OIDC_TOKEN` for the AI Gateway, from `vercel env pull` on the linked project. It lasts about 12 h; pull again to refresh. On Vercel it's automatic.

Without `DATABASE_URL`, kits are saved in a local PGlite database in `.data/`.

`FRONT_ROOM_OFFLINE=1 pnpm dev` runs with fixture data and a mock curator: no paid calls.

## Data path

Every Qloo call goes through [NotOnQ](https://notonq.vercel.app)'s drop-in API first (the same paths and shapes as
Qloo). On any NotOnQ error, or after 4 s, the same request goes straight to Qloo. Each source in a kit says which way
its data came.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

E2e starts its own offline server on :3510 and refuses to run against a server that isn't offline.

## Releases

Commits follow Conventional Commits (commitlint hook). Merging to `main` runs `.github/workflows/release.yml`:
1. semantic-release works out the version;
2. Vercel deploys it to production;
3. a smoke check reads `/api/version`;
4. only then are the tag and GitHub release made.

MIT licensed.
