/** Shapes returned by the Supabase queries in lib/queries.ts. */

export interface Sport {
  id: string
  slug: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface GameType {
  id: string
  sport_id: string
  slug: string
  name: string
  description: string | null
  sets_to_win: number
  points_to_win: number
  /** Winning margin: 2 for table tennis, 1 for foosball. */
  win_by: number
  k_factor: number
  is_active: boolean
  sort_order: number
}

export interface Profile {
  id: string
  display_name: string
}

export interface LeaderboardRow {
  game_type_id: string
  game_type_slug: string
  sport_slug: string
  sport_name: string
  player_id: string
  display_name: string
  rating: number
  wins: number
  losses: number
  matches_played: number
  rank: number
}

export interface Match {
  id: string
  game_type_id: string
  winner_id: string
  loser_id: string
  winner_score: number
  loser_score: number
  winner_rating_before: number
  winner_rating_after: number
  loser_rating_before: number
  loser_rating_after: number
  played_at: string
}

/** A match joined with the names it references, for the activity feed. */
export interface MatchWithNames extends Match {
  winner_name: string
  loser_name: string
  game_type_name: string
}

/** A player's rating in one variant, used to preview a prospective match. */
export interface RatingState {
  player_id: string
  rating: number
  matches_played: number
}
