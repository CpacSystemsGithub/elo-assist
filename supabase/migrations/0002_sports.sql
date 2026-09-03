-- ============================================================================
-- Add sports: table tennis and foosball, each with its own set of variants.
--
-- Additive and safe to run on a live database — existing game types, ratings
-- and match history are preserved and assigned to table tennis.
-- ============================================================================

create table if not exists public.sports (
  id          uuid primary key default gen_random_uuid(),
  slug        text    not null unique,
  name        text    not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int     not null default 0
);

insert into public.sports (slug, name, description, sort_order) values
  ('table-tennis', 'Table Tennis', 'The ping pong table.', 10),
  ('foosball',     'Foosball',     'The foosball table.',  20)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- Every variant now belongs to a sport.
-- ----------------------------------------------------------------------------
alter table public.game_types
  add column if not exists sport_id uuid references public.sports (id) on delete cascade;

-- Everything that existed before this migration was table tennis.
update public.game_types
set sport_id = (select id from public.sports where slug = 'table-tennis')
where sport_id is null;

alter table public.game_types alter column sport_id set not null;

-- ----------------------------------------------------------------------------
-- Winning margin is per variant.
--
-- Table tennis is win-by-two. Foosball is first to 10, win by one — without
-- this the margin check would reject every 10-9 foosball result.
-- ----------------------------------------------------------------------------
alter table public.game_types
  add column if not exists win_by int not null default 2 check (win_by between 1 and 2);

-- Slugs are unique per sport, not globally, so 'best-of-3' can exist for both.
alter table public.game_types drop constraint if exists game_types_slug_key;
create unique index if not exists game_types_sport_slug_idx
  on public.game_types (sport_id, slug);

insert into public.game_types
  (sport_id, slug, name, description, sets_to_win, points_to_win, win_by, k_factor, sort_order)
select s.id, v.slug, v.name, v.description, v.sets_to_win, v.points_to_win, v.win_by, v.k_factor, v.sort_order
from public.sports s
cross join (values
  ('single-10', 'Single game to 10', 'One game to 10 goals. The standard quick match.', 1, 10, 1, 32, 10),
  ('best-of-3', 'Best of 3',         'First to win 2 games of 10 goals.',               2, 10, 1, 32, 20),
  ('best-of-5', 'Best of 5',         'First to win 3 games of 10 goals.',               3, 10, 1, 24, 30)
) as v(slug, name, description, sets_to_win, points_to_win, win_by, k_factor, sort_order)
where s.slug = 'foosball'
on conflict (sport_id, slug) do nothing;

-- Give existing players a starting rating in the new variants so the foosball
-- board is populated from day one, exactly like table tennis.
insert into public.ratings (player_id, game_type_id)
select p.id, g.id from public.profiles p cross join public.game_types g
on conflict (player_id, game_type_id) do nothing;

-- ============================================================================
-- report_match: same Elo, margin now taken from the variant
-- ============================================================================
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
    if p_winner_score <> v_gt.sets_to_win or p_loser_score >= v_gt.sets_to_win then
      raise exception 'For % the winner needs exactly % sets and the loser fewer',
        v_gt.name, v_gt.sets_to_win;
    end if;
  else
    if p_winner_score < v_gt.points_to_win or (p_winner_score - p_loser_score) < v_gt.win_by then
      raise exception 'For % the winner needs at least % points and a margin of %',
        v_gt.name, v_gt.points_to_win, v_gt.win_by;
    end if;
  end if;

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
-- Leaderboard now carries its sport
-- ============================================================================
drop view if exists public.leaderboard;

create view public.leaderboard
with (security_invoker = on) as
select
  r.game_type_id,
  gt.slug as game_type_slug,
  s.slug  as sport_slug,
  s.name  as sport_name,
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
join public.profiles p    on p.id = r.player_id
join public.game_types gt on gt.id = r.game_type_id
join public.sports s      on s.id = gt.sport_id;

-- ============================================================================
-- Privileges for the new table and the recreated view
-- ============================================================================
alter table public.sports enable row level security;

drop policy if exists "sports are readable by everyone" on public.sports;
create policy "sports are readable by everyone"
  on public.sports for select to anon, authenticated using (true);

grant select on public.sports, public.leaderboard to anon, authenticated;
revoke insert, update, delete on public.sports, public.leaderboard from anon, authenticated;

revoke all on function public.report_match(uuid, uuid, uuid, int, int) from public;
grant execute on function public.report_match(uuid, uuid, uuid, int, int) to authenticated;

-- PostgREST caches the schema. Without this the API keeps serving the old
-- shape and calls fail with "Could not find the function in the schema cache".
notify pgrst, 'reload schema';
