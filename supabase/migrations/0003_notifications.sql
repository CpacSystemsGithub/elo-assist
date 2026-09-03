-- ============================================================================
-- Teams notifications: match results, hot streaks, and the Monday digest.
--
-- The app owns the Teams webhook and does the posting; this migration supplies
-- the numbers it announces, a claim table so nothing is ever posted twice, and
-- the pg_cron job that pokes the app every Monday.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notification_log: one row per thing announced, so retries and overlapping
-- cron runs can't double-post to the channel.
-- ----------------------------------------------------------------------------
create table if not exists public.notification_log (
  kind    text        not null,
  key     text        not null,
  sent_at timestamptz not null default now(),
  primary key (kind, key)
);

/**
 * Claim the right to announce something exactly once.
 * Returns true for the first caller and false for every caller after it.
 */
create or replace function public.claim_notification(p_kind text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_log (kind, key) values (p_kind, p_key);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ----------------------------------------------------------------------------
-- win_streak: consecutive wins for a player in a sport, counting back from
-- their most recent match. Scoped to the sport rather than the variant so a
-- run across best-of-3 and single-11 still counts as one streak.
-- ----------------------------------------------------------------------------
create or replace function public.win_streak(p_player_id uuid, p_sport_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  with recent as (
    select
      m.winner_id = p_player_id as won,
      row_number() over (order by m.played_at desc, m.id desc) as rn
    from public.matches m
    join public.game_types gt on gt.id = m.game_type_id
    where gt.sport_id = p_sport_id
      and (m.winner_id = p_player_id or m.loser_id = p_player_id)
  )
  select coalesce(
    -- Wins sitting above the most recent loss...
    (select min(rn) - 1 from recent where not won),
    -- ...or every match played, if they have never lost.
    (select count(*) from recent)
  )::int;
$$;

-- ----------------------------------------------------------------------------
-- weekly_digest: one row per sport with the week's headline figures.
--
--   climber — largest net rating gain across the sport
--   blunder — the single worst rating drop in one match
--   king    — the highest rating currently held in that sport
-- ----------------------------------------------------------------------------
create or replace function public.weekly_digest(p_since timestamptz default now() - interval '7 days')
returns table (
  sport_slug       text,
  sport_name       text,
  matches_played   int,
  climber_name     text,
  climber_gain     int,
  blunder_name     text,
  blunder_drop     int,
  blunder_opponent text,
  blunder_variant  text,
  blunder_score    text,
  king_name        text,
  king_rating      int,
  king_variant     text
)
language sql
stable
set search_path = public
as $$
  with in_window as (
    select m.*, gt.sport_id, gt.name as variant_name
    from public.matches m
    join public.game_types gt on gt.id = m.game_type_id
    where m.played_at >= p_since
  ),
  deltas as (
    select sport_id, winner_id as player_id,
           winner_rating_after - winner_rating_before as delta
    from in_window
    union all
    select sport_id, loser_id,
           loser_rating_after - loser_rating_before
    from in_window
  ),
  totals as (
    select sport_id, player_id, sum(delta)::int as gain
    from deltas group by sport_id, player_id
  ),
  climber as (
    select distinct on (sport_id) sport_id, player_id, gain
    from totals
    where gain > 0
    order by sport_id, gain desc, player_id
  ),
  blunder as (
    select distinct on (sport_id)
      sport_id,
      loser_id as player_id,
      (loser_rating_after - loser_rating_before) as drop,
      winner_id,
      variant_name,
      winner_score || '-' || loser_score as score
    from in_window
    order by sport_id, (loser_rating_after - loser_rating_before) asc, id
  ),
  king as (
    select distinct on (gt.sport_id)
      gt.sport_id, r.player_id, r.rating, gt.name as variant_name
    from public.ratings r
    join public.game_types gt on gt.id = r.game_type_id
    where r.matches_played > 0
    order by gt.sport_id, r.rating desc, r.player_id
  ),
  counts as (
    select sport_id, count(*)::int as played from in_window group by sport_id
  )
  select
    s.slug,
    s.name,
    coalesce(c.played, 0),
    cp.display_name,
    cl.gain,
    bp.display_name,
    b.drop,
    bo.display_name,
    b.variant_name,
    b.score,
    kp.display_name,
    k.rating,
    k.variant_name
  from public.sports s
  left join counts  c  on c.sport_id  = s.id
  left join climber cl on cl.sport_id = s.id
  left join public.profiles cp on cp.id = cl.player_id
  left join blunder b  on b.sport_id  = s.id
  left join public.profiles bp on bp.id = b.player_id
  left join public.profiles bo on bo.id = b.winner_id
  left join king k     on k.sport_id  = s.id
  left join public.profiles kp on kp.id = k.player_id
  where s.is_active
  order by s.sort_order;
$$;

-- ============================================================================
-- Privileges
--
-- All three are read-only over data that is already world-readable, except
-- claim_notification which only ever inserts its own bookkeeping row.
-- ============================================================================
alter table public.notification_log enable row level security;
-- No policies: the table is reachable only through claim_notification().

grant execute on function public.win_streak(uuid, uuid)      to anon, authenticated;
grant execute on function public.weekly_digest(timestamptz)  to anon, authenticated;
grant execute on function public.claim_notification(text, text) to anon, authenticated;

-- ============================================================================
-- Monday morning cron
--
-- Requires the pg_cron and pg_net extensions (Database -> Extensions in the
-- Supabase dashboard, or the create extension statements below).
--
-- EDIT THE TWO PLACEHOLDERS before running: the app's public URL and the same
-- secret you put in CRON_SECRET in .env.local.
--
-- The schedule is UTC. '0 7 * * 1' is 08:00 in Swedish winter time and 09:00
-- in summer — adjust if you want it pinned to local time.
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace any previous version of the job before scheduling it again.
select cron.unschedule('weekly-ladder-digest')
where exists (select 1 from cron.job where jobname = 'weekly-ladder-digest');

select cron.schedule(
  'weekly-ladder-digest',
  '0 7 * * 1',
  $job$
  select net.http_post(
    url     := 'https://REPLACE-WITH-YOUR-APP-URL/api/notifications/weekly',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'x-cron-secret', 'REPLACE-WITH-YOUR-CRON-SECRET'
    ),
    body    := '{}'::jsonb
  );
  $job$
);

notify pgrst, 'reload schema';
