# CPAC Ping Pong Ladder

Elo ratings for the office table tennis table, with a leaderboard built to sit
on a wall screen.

- **Sign up** requires a `@cpacsystems.se` address.
- **Report a result** against a colleague; ratings update immediately.
- **Elo** — what you gain depends on who you beat, not just that you won.
- **Two sports** — table tennis and foosball, switched by tabs, each with the
  same layout.
- **Variants per sport** — table tennis has single game to 11, best of 3, best
  of 5 and single game to 21; foosball has single game to 10, best of 3 and
  best of 5. Every variant is rated separately.
- **Teams notifications** — every result, hot-streak milestones, and a Monday
  morning round-up of the biggest climber, biggest blunder and king of the hill
  for each sport.

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

Run the files in [`supabase/migrations/`](supabase/migrations/) **in order** in
the Supabase **SQL Editor** (or `supabase db push` if you use the CLI):

1. `0001_init.sql` — tables, row level security, the `@cpacsystems.se` signup
   trigger, and `report_match()`.
2. `0002_sports.sql` — adds sports (table tennis + foosball) and the
   per-variant winning margin.
3. `0003_notifications.sql` — streak and digest figures, and the Monday cron
   job. **Edit the two placeholders at the bottom first** (see
   [Teams notifications](#teams-notifications)).

All three are safe to re-run, and each preserves the players, ratings and match
history recorded by the ones before it.

> If a call later fails with **"Could not find the table/function … in the
> schema cache"**, PostgREST is serving a stale schema. Run
> `notify pgrst, 'reload schema';` — each migration already ends with it.

### 4. Decide about email confirmation

**Simplest — turn it off.** Authentication → Sign In / Providers → Email →
**Confirm email: off**. Signups are already restricted to company addresses by
a database trigger, so confirmation mostly adds a step, and new players are
signed in immediately.

**Or leave it on.** Supabase sends the mail itself; the app handles the
landing. Two things then need setting up on the Supabase side:

1. **Point the email template at this app.** Authentication → Emails →
   _Confirm signup_, and make the link:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```

   That reaches [`app/auth/confirm/route.ts`](app/auth/confirm/route.ts),
   which trades the one-time token for a session cookie so the new player
   arrives already signed in. The stock template uses `{{ .ConfirmationURL }}`
   instead, which confirms the address but drops them at the site signed out.

   Also set **Site URL** under Authentication → URL Configuration to wherever
   the app runs, and list that origin under **Redirect URLs**.

2. **Configure SMTP.** Authentication → Emails → SMTP Settings. Supabase's
   built-in sender is rate limited to a handful of messages per hour and is
   explicitly not intended for production — a team signing up at once will hit
   that ceiling. Point it at the company mail server or a service like Resend.

An expired or already-used link redirects to `/login` with an explanation
rather than failing silently.

### 5. Run it

```bash
npm run dev
```

The leaderboard is at `/`, public and signed-out — point the wall screen at
`http://<host>:3000/?sport=table-tennis&game=best-of-3` and leave it. Sport and
variant both live in the URL, so the screen stays where you put it across
refreshes. It refreshes every 30 seconds on its own.

## Teams notifications

Optional. Leave the webhook variables unset and the ladder simply posts
nothing. Each sport posts to its own channel: `TEAMS_WEBHOOK_URL_PINGPONG` for
table tennis, `TEAMS_WEBHOOK_URL_FUSSBALL` for foosball, with
`TEAMS_WEBHOOK_URL` as a fallback for either.

### What gets posted

| When                             | Message                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every reported result            | Who beat whom, the score, both new ratings and the swing. Flagged `upset!` when the lower-rated player won.                                                                |
| A win streak reaches a milestone | At **3**, **5**, **15**, then every further 15 (30, 45, 60…). Streaks count across a sport's variants but not between sports.                                              |
| Monday morning                   | Per sport: **king of the hill**, **biggest climber** (largest net rating gain over the week) and **biggest blunder** (worst single-match rating drop, with the scoreline). Each sport's round-up goes to its own channel. |

### Setting it up

1. **Create the webhook.** In each Teams channel: **⋯ → Workflows → "Post to a
   channel when a webhook request is received"**. Copy the generated URLs into
   `TEAMS_WEBHOOK_URL_PINGPONG` and `TEAMS_WEBHOOK_URL_FUSSBALL` in
   `.env.local`.

   This is the Workflows/Power Automate trigger, not the retired Office 365
   connector. The app sends an Adaptive Card in the envelope Workflows expects.

2. **Set a cron secret.** `openssl rand -hex 32`, into `CRON_SECRET` in
   `.env.local`. It guards `/api/notifications/weekly`, which posts to a
   company channel. The route refuses to run at all if the secret is unset.

3. **Schedule the digest.** In `0003_notifications.sql`, replace
   `REPLACE-WITH-YOUR-APP-URL` with the app's URL as reachable _from Supabase_
   (a public URL — a `localhost` address will not work) and
   `REPLACE-WITH-YOUR-CRON-SECRET` with the same secret, then run the file.

   The schedule is `0 7 * * 1` — **UTC**, so 08:00 Swedish winter time and
   09:00 in summer. Change it if you want it pinned to local time.

To test the wiring without waiting for Monday:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  "https://your-app/api/notifications/weekly?force=1"
```

`?force=1` bypasses the once-per-week guard.

### Why nothing gets posted twice

Every announcement is claimed in `notification_log` before it is sent — keyed
on the match id for results and streaks, and on the ISO week for the digest. A
cron retry, a double submit or an overlapping run posts nothing new. Result
announcements are sent via `after()`, so a slow or unreachable webhook never
delays the person reporting a score, and a Teams outage can never make a
recorded result look like it failed.

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
  quickly. They are shown as _Provisional_ until then.
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

## Adding a variant or a sport

Both are data, not code. A new table-tennis variant:

```sql
insert into public.game_types
  (sport_id, slug, name, description, sets_to_win, points_to_win, win_by, k_factor, sort_order)
select id, 'best-of-7', 'Best of 7', 'First to win 4 games of 11 points.', 4, 11, 2, 20, 50
from public.sports where slug = 'table-tennis';
```

A whole new sport — insert into `sports`, then its variants, and it appears as
another tab with the identical layout:

```sql
insert into public.sports (slug, name, description, sort_order)
values ('darts', 'Darts', 'The dartboard by the kitchen.', 30);
```

Column meanings:

- `sets_to_win = 1` — scores are entered as **points**, and the winner must
  reach `points_to_win` with a margin of `win_by`.
- `sets_to_win > 1` — scores are entered as **sets won**, and the winner must
  have exactly `sets_to_win`.
- `win_by` — 2 for table tennis, 1 for foosball. Without this a legitimate
  10–9 foosball result would be rejected.

Existing players get a rating in a new variant the first time they play it; run
the backfill at the end of `0002_sports.sql` if you want them on the board at
1000 straight away.

## Layout

| Path                                    | What it holds                                                            |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `supabase/migrations/`                  | Schema, RLS, grants, triggers, `report_match()`                          |
| `lib/elo.ts`                            | Elo formula (preview only)                                               |
| `lib/queries.ts`                        | Server-side reads                                                        |
| `lib/actions/`                          | Server Actions: sign up, sign in, report a match                         |
| `lib/supabase/`                         | Browser, server and proxy clients                                        |
| `proxy.ts`                              | Session refresh + guards `/report` (Next 16 renamed Middleware to Proxy) |
| `app/page.tsx`                          | The leaderboard / wall screen                                            |
| `components/sport-nav.tsx`              | Table tennis / foosball tabs                                             |
| `app/report/page.tsx`                   | Report a result                                                          |
| `app/auth/confirm/route.ts`             | Where the confirmation email link lands                                  |
| `lib/notifications/`                    | Teams client, Adaptive Cards, streak milestones                          |
| `app/api/notifications/weekly/route.ts` | The Monday digest, called by pg_cron                                     |

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
