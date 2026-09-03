# CPAC Ping Pong Ladder

Elo ratings for the office table tennis table, with a leaderboard built to sit
on a wall screen.

- **Sign up** requires a `@cpacsystems.se` address.
- **Report a result** against a colleague; ratings update immediately.
- **Elo** — what you gain depends on who you beat, not just that you won.
- **Variants** — single game to 11, best of 3, best of 5, single game to 21.
  Each is rated separately.

## Setup

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), then note the project URL and the
browser-safe key from **Project Settings → API keys** (labelled either `anon`
or `publishable`).

### 2. Configure the app

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Install the schema

Paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
into the Supabase **SQL Editor** and run it (or `supabase db push` if you use
the CLI). It creates the tables, the four starting variants, row level
security, the `@cpacsystems.se` signup trigger, and `report_match()`.

### 4. Turn off email confirmation (recommended)

**Authentication → Sign In / Providers → Email → Confirm email: off.**

Signups are already restricted to company addresses by a database trigger, so
confirmation mostly just adds a step. Leave it on and the app will tell people
to check their inbox — that path works too, but needs SMTP configured.

### 5. Run it

```bash
npm run dev
```

The leaderboard is at `/`, public and signed-out — point the wall screen at
`http://<host>:3000/?game=best-of-3` and leave it. It refreshes every 30
seconds on its own.

## How the rating works

Standard Elo. Your expected score against an opponent is

```
E = 1 / (1 + 10^((opponentRating - yourRating) / 400))
```

and the result moves you by `K x (actual - expected)`, where actual is 1 for a
win and 0 for a loss. Consequences:

- Everyone starts at **1000** in every variant.
- Beating someone far above you is worth a lot; beating someone far below you
  is worth almost nothing. Losing works the same way in reverse.
- **K** is per variant (`game_types.k_factor`, 32 by default, 24 for best of 5
  since those results are less noisy). It is multiplied by 1.5 for a player's
  first 10 matches in a variant, so new colleagues reach their real level
  quickly. They are shown as *Provisional* until then.
- Ratings are integers, so rounding means a match is occasionally off from
  exactly zero sum by a point.

The report form previews the swing both ways before you submit, so you can see
what a match is worth.

### Where the maths lives

`report_match()` in the migration is the **authoritative** implementation and
the only thing that writes `ratings` or `matches`. It runs `SECURITY DEFINER`
and neither `anon` nor `authenticated` has write access to those tables, so a
result cannot be invented and a rating cannot be hand-edited from the client.
It also verifies that the reporter actually played in the match.

[`lib/elo.ts`](lib/elo.ts) repeats the same formula in TypeScript purely to
render the preview. Retune one and you must retune the other.

## Adding a variant

Insert a row in `game_types` — no code change needed:

```sql
insert into public.game_types (slug, name, description, sets_to_win, points_to_win, k_factor, sort_order)
values ('best-of-7', 'Best of 7', 'First to win 4 games of 11 points.', 4, 11, 20, 50);
```

`sets_to_win = 1` means scores are entered as **points** (and must clear
`points_to_win` by two). Above 1 they are entered as **sets won**, and the
winner must have exactly `sets_to_win`. Existing players get a rating in a new
variant the first time they play it.

## Layout

| Path | What it holds |
| --- | --- |
| `supabase/migrations/0001_init.sql` | Schema, RLS, grants, triggers, `report_match()` |
| `lib/elo.ts` | Elo formula (preview only) |
| `lib/queries.ts` | Server-side reads |
| `lib/actions/` | Server Actions: sign up, sign in, report a match |
| `lib/supabase/` | Browser, server and proxy clients |
| `proxy.ts` | Session refresh + guards `/report` (Next 16 renamed Middleware to Proxy) |
| `app/page.tsx` | The leaderboard / wall screen |
| `app/report/page.tsx` | Report a result |

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
