import "server-only"

import { createClient } from "@/lib/supabase/server"
import { matchResultCard, streakCard } from "@/lib/notifications/cards"
import { streakMilestone } from "@/lib/notifications/streaks"
import { isTeamsConfigured, postToTeams } from "@/lib/notifications/teams"
import type { Match } from "@/lib/types"

/**
 * Announce a freshly recorded match, and the winner's streak if it just hit a
 * milestone.
 *
 * Runs via after() so the reporter's form responds immediately. Never throws —
 * a Teams outage must not make a recorded result look like a failure.
 */
export async function announceMatch(match: Match): Promise<void> {
  if (!isTeamsConfigured()) return

  try {
    const supabase = await createClient()

    const [{ data: names }, { data: gameType }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [match.winner_id, match.loser_id]),
      supabase
        .from("game_types")
        .select("name, sport_id, sports(id, name)")
        .eq("id", match.game_type_id)
        .single(),
    ])

    const nameOf = (id: string) =>
      names?.find((p) => p.id === id)?.display_name ?? "Someone"

    // The embedded sport arrives as an object or a single-element array
    // depending on how PostgREST resolves the relationship.
    const sportRelation = (gameType as { sports?: unknown } | null)?.sports
    const sport = (
      Array.isArray(sportRelation) ? sportRelation[0] : sportRelation
    ) as { id: string; name: string } | undefined

    const winnerName = nameOf(match.winner_id)

    // Keyed on the match, so a retry of this same result posts nothing new.
    const { data: resultClaimed } = await supabase.rpc("claim_notification", {
      p_kind: "match",
      p_key: match.id,
    })
    if (resultClaimed !== true) return

    await postToTeams(
      matchResultCard({
        winnerName,
        loserName: nameOf(match.loser_id),
        winnerScore: match.winner_score,
        loserScore: match.loser_score,
        winnerDelta: match.winner_rating_after - match.winner_rating_before,
        loserDelta: match.loser_rating_after - match.loser_rating_before,
        winnerRatingAfter: match.winner_rating_after,
        loserRatingAfter: match.loser_rating_after,
        sportName: sport?.name ?? "",
        variantName: (gameType as { name?: string } | null)?.name ?? "",
        wasUpset: match.winner_rating_before < match.loser_rating_before,
      })
    )

    if (!sport?.id) return

    const { data: streak } = await supabase.rpc("win_streak", {
      p_player_id: match.winner_id,
      p_sport_id: sport.id,
    })

    const milestone = streakMilestone(Number(streak ?? 0))
    if (milestone === null) return

    // Keyed on the match that reached the milestone, not on the player and
    // number — someone who hits 3, loses, then hits 3 again deserves the second
    // shout, while a retry of this match still posts nothing.
    const { data: claimed } = await supabase.rpc("claim_notification", {
      p_kind: "streak",
      p_key: `${match.id}:${milestone}`,
    })
    if (claimed !== true) return

    await postToTeams(streakCard(winnerName, milestone, sport.name))
  } catch (error) {
    console.error("Could not announce match to Teams:", error)
  }
}
