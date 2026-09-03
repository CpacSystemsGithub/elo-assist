-- ============================================================================
-- CPAC Systems ping pong ladder — initial schema
--
-- Run this in the Supabase SQL editor (or `supabase db push`) as the postgres
-- role. It creates the profile/game-type/rating/match tables, locks signups to
-- @cpacsystems.se, and defines report_match() — the single authoritative
-- implementation of the Elo update.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: public identity for each authenticated user.
-- Deliberately holds NO email. The address lives in auth.users, so the
-- leaderboard can be world-readable on the wall screen without leaking
-- addresses.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null check (length(btrim(display_name)) between 2 and 40),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- game_types: the table-tennis variants people can play.
--
-- sets_to_win = 1  -> a single game; scores entered are POINTS (e.g. 11-7)
-- sets_to_win > 1  -> a best-of series; scores entered are SETS  (e.g. 2-1)
-- ----------------------------------------------------------------------------
create table if not exists public.game_types (
  id            uuid primary key default gen_random_uuid(),
  slug          text    not null unique,
  name          text    not null,
  description   text,
  sets_to_win   int     not null default 1 check (sets_to_win between 1 and 5),
  points_to_win int     not null default 11 check (points_to_win between 1 and 100),
  k_factor      int     not null default 32 check (k_factor between 1 and 100),
  is_active     boolean not null default true,
  sort_order    int     not null default 0
);

insert into public.game_types (slug, name, description, sets_to_win, points_to_win, k_factor, sort_order)
values
  ('single-11', 'Single game to 11', 'One game to 11 points, win by 2. The quick lunch-break match.',      1, 11, 32, 10),
  ('best-of-3', 'Best of 3',         'First to win 2 games of 11 points.',                                  2, 11, 32, 20),
  ('best-of-5', 'Best of 5',         'First to win 3 games of 11 points. The long format.',                 3, 11, 24, 30),
  ('single-21', 'Single game to 21', 'Classic single game to 21 points, win by 2.',                         1, 21, 32, 40)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- ratings: one Elo rating per (player, game type).
--
-- Each variant is its own ladder — being great at best-of-5 says nothing about
-- your single-game-to-11 rating, the same way chess rates blitz and classical
-- separately.
-- ----------------------------------------------------------------------------
create table if not exists public.ratings (
  player_id      uuid        not null references public.profiles (id) on delete cascade,
  game_type_id   uuid        not null references public.game_types (id) on delete cascade,
  rating         int         not null default 1000,
  wins           int         not null default 0,
  losses         int         not null default 0,
  matches_played int         not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (player_id, game_type_id)
);

create index if not exists ratings_game_type_rating_idx
  on public.ratings (game_type_id, rating desc);

-- ----------------------------------------------------------------------------
-- matches: an immutable log of results.
--
-- The before/after ratings are denormalised onto the row so the history stays
-- truthful even if the Elo constants are retuned later.
-- ----------------------------------------------------------------------------
create table if not exists public.matches (
  id                   uuid primary key default gen_random_uuid(),
  game_type_id         uuid        not null references public.game_types (id),
  winner_id            uuid        not null references public.profiles (id) on delete cascade,
  loser_id             uuid        not null references public.profiles (id) on delete cascade,
  winner_score         int         not null check (winner_score >= 0),
  loser_score          int         not null check (loser_score >= 0),
  winner_rating_before int         not null,
  winner_rating_after  int         not null,
  loser_rating_before  int         not null,
  loser_rating_after   int         not null,
  reported_by          uuid        not null references public.profiles (id),
  played_at            timestamptz not null default now(),
  constraint matches_distinct_players check (winner_id <> loser_id),
  constraint matches_winner_scored_more check (winner_score > loser_score)
);

create index if not exists matches_played_at_idx on public.matches (played_at desc);
create index if not exists matches_winner_idx    on public.matches (winner_id, played_at desc);
create index if not exists matches_loser_idx     on public.matches (loser_id, played_at desc);

-- ============================================================================
-- Signup restriction: @cpacsystems.se only
-- ============================================================================

-- `like '%@cpacsystems.se'` anchors on the '@', so a lookalike domain such as
-- evil.cpacsystems.se (which ends in '.cpacsystems.se') is correctly rejected.
create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@cpacsystems.se' then
    raise exception 'Only @cpacsystems.se email addresses can join the ladder'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_domain on auth.users;
create trigger enforce_email_domain
  before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- ============================================================================
-- New user -> profile + a starting rating in every active game type
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  -- Prefer the name typed at signup; fall back to the email local part.
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  v_name := coalesce(v_name, split_part(new.email, '@', 1));

  insert into public.profiles (id, display_name)
  values (new.id, left(v_name, 40))
  on conflict (id) do nothing;

  -- Seed 1000 in each active variant so new colleagues show up on the board
  -- immediately rather than after their first game.
  insert into public.ratings (player_id, game_type_id)
  select new.id, gt.id from public.game_types gt where gt.is_active
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Elo
-- ============================================================================

-- Provisional players move faster: their rating is still finding its level.
create or replace function public.elo_k(p_base_k int, p_matches_played int)
returns numeric
language sql
immutable
as $$
  select case when p_matches_played < 10 then p_base_k * 1.5 else p_base_k::numeric end;
$$;

-- Probability that a player rated p_rating beats one rated p_opponent_rating.
create or replace function public.elo_expected(p_rating int, p_opponent_rating int)
returns numeric
language sql
immutable
as $$
  select 1.0 / (1.0 + power(10.0, (p_opponent_rating - p_rating)::numeric / 400.0));
$$;

-- ----------------------------------------------------------------------------
-- report_match: the ONLY way rows enter public.matches and the only writer of
-- public.ratings. SECURITY DEFINER + no direct table grants means a client
-- cannot invent a result or hand-edit its own rating.
-- ----------------------------------------------------------------------------
create or replace function public.report_match(
  p_game_type_id uuid,
  p_winner_id    uuid,
  p_loser_id     uuid,
  p_winner_score int,
  p_loser_score  int
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_gt         public.game_types%rowtype;
  v_w_rating   int;
  v_w_played   int;
  v_l_rating   int;
  v_l_played   int;
  v_expected_w numeric;
  v_w_after    int;
  v_l_after    int;
  v_match      public.matches%rowtype;
begin
  if v_actor is null then
    raise exception 'You must be signed in to report a match' using errcode = 'insufficient_privilege';
  end if;

  if p_winner_id = p_loser_id then
    raise exception 'A match needs two different players';
  end if;

  -- You may only file results for games you actually played in.
  if v_actor <> p_winner_id and v_actor <> p_loser_id then
    raise exception 'You can only report matches you played in' using errcode = 'insufficient_privilege';
  end if;

  select * into v_gt from public.game_types where id = p_game_type_id and is_active;
  if not found then
    raise exception 'Unknown or inactive game type';
  end if;

  if p_winner_score is null or p_loser_score is null or p_winner_score <= p_loser_score then
    raise exception 'The winner must have the higher score';
  end if;

  if v_gt.sets_to_win > 1 then
    -- Best-of series: scores are sets won.
    if p_winner_score <> v_gt.sets_to_win or p_loser_score >= v_gt.sets_to_win then
      raise exception 'For % the winner needs exactly % sets and the loser fewer',
        v_gt.name, v_gt.sets_to_win;
    end if;
  else
    -- Single game: scores are points, and you must win by two.
    if p_winner_score < v_gt.points_to_win or (p_winner_score - p_loser_score) < 2 then
      raise exception 'For % the winner needs at least % points and a two point margin',
        v_gt.name, v_gt.points_to_win;
    end if;
  end if;

  -- Make sure both players have a rating row for this variant (a variant added
  -- after they signed up would otherwise have none), then lock both rows in a
  -- stable order so simultaneous reports can't lose an update.
  insert into public.ratings (player_id, game_type_id)
  values (p_winner_id, p_game_type_id), (p_loser_id, p_game_type_id)
  on conflict (player_id, game_type_id) do nothing;

  perform 1
  from public.ratings
  where game_type_id = p_game_type_id
    and player_id in (p_winner_id, p_loser_id)
  order by player_id
  for update;

  select rating, matches_played into v_w_rating, v_w_played
  from public.ratings where player_id = p_winner_id and game_type_id = p_game_type_id;

  select rating, matches_played into v_l_rating, v_l_played
  from public.ratings where player_id = p_loser_id and game_type_id = p_game_type_id;

  -- Standard Elo. The winner's gain scales with how unlikely the win was, so
  -- beating a much stronger opponent is worth far more than beating a weaker
  -- one — and each player moves by their own K.
  v_expected_w := public.elo_expected(v_w_rating, v_l_rating);

  v_w_after := round(v_w_rating + public.elo_k(v_gt.k_factor, v_w_played) * (1 - v_expected_w));
  v_l_after := round(v_l_rating - public.elo_k(v_gt.k_factor, v_l_played) * (1 - v_expected_w));

  update public.ratings
  set rating = v_w_after, wins = wins + 1, matches_played = matches_played + 1, updated_at = now()
  where player_id = p_winner_id and game_type_id = p_game_type_id;

  update public.ratings
  set rating = v_l_after, losses = losses + 1, matches_played = matches_played + 1, updated_at = now()
  where player_id = p_loser_id and game_type_id = p_game_type_id;

  insert into public.matches (
    game_type_id, winner_id, loser_id, winner_score, loser_score,
    winner_rating_before, winner_rating_after,
    loser_rating_before, loser_rating_after,
    reported_by
  )
  values (
    p_game_type_id, p_winner_id, p_loser_id, p_winner_score, p_loser_score,
    v_w_rating, v_w_after,
    v_l_rating, v_l_after,
    v_actor
  )
  returning * into v_match;

  return v_match;
end;
$$;

-- ============================================================================
-- Leaderboard view
-- ============================================================================
create or replace view public.leaderboard
with (security_invoker = on) as
select
  r.game_type_id,
  gt.slug as game_type_slug,
  r.player_id,
  p.display_name,
  r.rating,
  r.wins,
  r.losses,
  r.matches_played,
  rank() over (
    partition by r.game_type_id
    order by r.rating desc, r.wins desc, p.display_name asc
  ) as rank
from public.ratings r
join public.profiles p   on p.id = r.player_id
join public.game_types gt on gt.id = r.game_type_id;

-- ============================================================================
-- Row level security
--
-- Everything is readable (the wall screen runs signed out); nothing is
-- directly writable. All mutation goes through report_match().
-- ============================================================================
alter table public.profiles   enable row level security;
alter table public.game_types enable row level security;
alter table public.ratings    enable row level security;
alter table public.matches    enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "players can rename themselves" on public.profiles;
create policy "players can rename themselves"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "game types are readable by everyone" on public.game_types;
create policy "game types are readable by everyone"
  on public.game_types for select to anon, authenticated using (true);

drop policy if exists "ratings are readable by everyone" on public.ratings;
create policy "ratings are readable by everyone"
  on public.ratings for select to anon, authenticated using (true);

drop policy if exists "matches are readable by everyone" on public.matches;
create policy "matches are readable by everyone"
  on public.matches for select to anon, authenticated using (true);

-- No insert/update/delete policies on ratings or matches: report_match() runs
-- as definer and bypasses RLS, so it stays the only write path.

-- ============================================================================
-- Table privileges
--
-- RLS narrows what a role may touch, but only *after* it has the underlying
-- grant. Supabase hands anon/authenticated a blanket grant on public by
-- default, so spell the intended privileges out here rather than inheriting
-- whatever that default happens to be.
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- Read-only for everyone, so the wall screen works signed out.
grant select on
  public.profiles, public.game_types, public.ratings,
  public.matches, public.leaderboard
to anon, authenticated;

-- Undo Supabase's default blanket grant: results are written only by
-- report_match(), and history is never edited or deleted.
revoke insert, update, delete on
  public.game_types, public.ratings, public.matches, public.leaderboard
from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- The one thing a player may change about themselves is their name, and the
-- RLS policy above confines that to their own row.
grant update (display_name) on public.profiles to authenticated;

revoke all on function public.report_match(uuid, uuid, uuid, int, int) from public;
grant execute on function public.report_match(uuid, uuid, uuid, int, int) to authenticated;
