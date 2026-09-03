/**
 * Elo rating maths.
 *
 * IMPORTANT: the authoritative implementation is report_match() in
 * supabase/migrations/0001_init.sql. Ratings are only ever written there, so a
 * client cannot influence them. This module is the same formula in TypeScript,
 * used to *preview* the swing in the report form ("beat Anna: +21 / lose: -11").
 * Keep the two in step if you retune anything.
 */

export const STARTING_RATING = 1000

/** Below this many matches a player is still provisional and moves faster. */
export const PROVISIONAL_MATCHES = 10
const PROVISIONAL_MULTIPLIER = 1.5

/**
 * The K-factor actually applied to a player: how many rating points a totally
 * unexpected result is worth.
 */
export function effectiveK(baseK: number, matchesPlayed: number): number {
  return matchesPlayed < PROVISIONAL_MATCHES
    ? baseK * PROVISIONAL_MULTIPLIER
    : baseK
}

/**
 * Probability that `rating` beats `opponentRating`.
 *
 * Equal ratings give 0.5; every 400 points of advantage makes you 10x more
 * likely to win. This is the whole reason the ladder is Elo rather than a
 * win counter — the size of your gain depends on who you beat.
 */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400))
}

export interface PlayerRatingState {
  rating: number
  matchesPlayed: number
}

export interface EloOutcome {
  winnerBefore: number
  winnerAfter: number
  winnerDelta: number
  loserBefore: number
  loserAfter: number
  loserDelta: number
  /** The winner's pre-match win probability, 0-1. */
  winnerExpected: number
}

/**
 * Apply one result. Mirrors report_match(): each player moves by their own K,
 * driven by the winner's expected score.
 */
export function applyResult(
  winner: PlayerRatingState,
  loser: PlayerRatingState,
  baseK: number
): EloOutcome {
  const winnerExpected = expectedScore(winner.rating, loser.rating)
  const surprise = 1 - winnerExpected

  const winnerAfter = Math.round(
    winner.rating + effectiveK(baseK, winner.matchesPlayed) * surprise
  )
  const loserAfter = Math.round(
    loser.rating - effectiveK(baseK, loser.matchesPlayed) * surprise
  )

  return {
    winnerBefore: winner.rating,
    winnerAfter,
    winnerDelta: winnerAfter - winner.rating,
    loserBefore: loser.rating,
    loserAfter,
    loserDelta: loserAfter - loser.rating,
    winnerExpected,
  }
}

/**
 * Both directions of a hypothetical match, for the "what's at stake" preview.
 */
export function previewMatch(
  you: PlayerRatingState,
  opponent: PlayerRatingState,
  baseK: number
) {
  const ifYouWin = applyResult(you, opponent, baseK)
  const ifYouLose = applyResult(opponent, you, baseK)

  return {
    winDelta: ifYouWin.winnerDelta,
    lossDelta: ifYouLose.loserDelta,
    winProbability: expectedScore(you.rating, opponent.rating),
  }
}
