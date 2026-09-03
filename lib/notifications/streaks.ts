/**
 * Which win streaks are worth announcing.
 *
 * Milestones are 3, 5 and 15, then every further 15 (30, 45, 60 …) so a long
 * run keeps getting noticed without filling the channel.
 */
export function streakMilestone(streak: number): number | null {
  if (streak === 3 || streak === 5) return streak
  if (streak >= 15 && streak % 15 === 0) return streak
  return null
}

/** Flavour text that escalates with the streak. */
export function streakTitle(streak: number): string {
  if (streak >= 45)
    return `${streak} in a row. Someone please stage an intervention`
  if (streak >= 30) return `${streak} straight wins — this is a dynasty`
  if (streak >= 15) return `${streak} wins on the bounce`
  if (streak >= 5) return `${streak} in a row and counting`
  return `${streak} wins in a row`
}
