import "server-only"

import { createClient } from "@/lib/supabase/server"
import type {
  GameType,
  LeaderboardRow,
  MatchWithNames,
  Profile,
  RatingState,
} from "@/lib/types"

export async function getGameTypes(): Promise<GameType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("game_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  if (error) throw new Error(`Could not load game types: ${error.message}`)
  return (data ?? []) as GameType[]
}

export async function getLeaderboard(
  gameTypeId: string
): Promise<LeaderboardRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("game_type_id", gameTypeId)
    .order("rank")

  if (error) throw new Error(`Could not load the leaderboard: ${error.message}`)
  return (data ?? []) as LeaderboardRow[]
}

/**
 * Recent results for one variant, with player and variant names resolved.
 * Drives both the activity feed and the per-player form guide.
 */
export async function getRecentMatches(
  gameTypeId: string,
  limit = 40
): Promise<MatchWithNames[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("matches")
    .select(
      `*,
       winner:profiles!matches_winner_id_fkey(display_name),
       loser:profiles!matches_loser_id_fkey(display_name),
       game_type:game_types(name)`
    )
    .eq("game_type_id", gameTypeId)
    .order("played_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Could not load recent matches: ${error.message}`)

  type Joined = MatchWithNames & {
    winner: { display_name: string } | null
    loser: { display_name: string } | null
    game_type: { name: string } | null
  }

  return ((data ?? []) as Joined[]).map((row) => ({
    ...row,
    winner_name: row.winner?.display_name ?? "Unknown",
    loser_name: row.loser?.display_name ?? "Unknown",
    game_type_name: row.game_type?.name ?? "",
  }))
}

/** Everyone except `excludeId` — the opponent picker on the report form. */
export async function getOpponents(excludeId: string): Promise<Profile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .neq("id", excludeId)
    .order("display_name")

  if (error) throw new Error(`Could not load players: ${error.message}`)
  return (data ?? []) as Profile[]
}

/**
 * Every rating row, so the report form can preview the swing against any
 * opponent in any variant without a round trip per selection.
 */
export async function getAllRatings(): Promise<
  (RatingState & { game_type_id: string })[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ratings")
    .select("player_id, game_type_id, rating, matches_played")

  if (error) throw new Error(`Could not load ratings: ${error.message}`)
  return (data ?? []) as (RatingState & { game_type_id: string })[]
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw new Error(`Could not load your profile: ${error.message}`)
  return (data as Profile | null) ?? null
}
