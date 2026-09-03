import "server-only"

import { signed } from "@/lib/format"
import { streakTitle } from "@/lib/notifications/streaks"
import type { AdaptiveCard } from "@/lib/notifications/teams"

const SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json"

function card(body: unknown[]): AdaptiveCard {
  return { type: "AdaptiveCard", $schema: SCHEMA, version: "1.4", body }
}

function heading(text: string, subtitle?: string) {
  const blocks: unknown[] = [
    { type: "TextBlock", text, weight: "Bolder", size: "Medium", wrap: true },
  ]
  if (subtitle) {
    blocks.push({
      type: "TextBlock",
      text: subtitle,
      isSubtle: true,
      spacing: "None",
      wrap: true,
    })
  }
  return blocks
}

export interface MatchAnnouncement {
  winnerName: string
  loserName: string
  winnerScore: number
  loserScore: number
  winnerDelta: number
  loserDelta: number
  winnerRatingAfter: number
  loserRatingAfter: number
  sportName: string
  variantName: string
  /** True when the lower-rated player won — worth calling out. */
  wasUpset: boolean
}

export function matchResultCard(m: MatchAnnouncement): AdaptiveCard {
  return card([
    ...heading(
      `${m.winnerName} beat ${m.loserName} ${m.winnerScore}–${m.loserScore}`,
      `${m.sportName} · ${m.variantName}${m.wasUpset ? " · upset!" : ""}`
    ),
    {
      type: "FactSet",
      facts: [
        {
          title: m.winnerName,
          value: `${m.winnerRatingAfter} (${signed(m.winnerDelta)})`,
        },
        {
          title: m.loserName,
          value: `${m.loserRatingAfter} (${signed(m.loserDelta)})`,
        },
      ],
    },
  ])
}

export function streakCard(
  playerName: string,
  streak: number,
  sportName: string
): AdaptiveCard {
  return card([
    ...heading(
      `${playerName}: ${streakTitle(streak)}`,
      `${sportName} · hot streak`
    ),
  ])
}

export interface DigestRow {
  sport_slug: string
  sport_name: string
  matches_played: number
  climber_name: string | null
  climber_gain: number | null
  blunder_name: string | null
  blunder_drop: number | null
  blunder_opponent: string | null
  blunder_variant: string | null
  blunder_score: string | null
  king_name: string | null
  king_rating: number | null
  king_variant: string | null
}

/** The Monday round-up: one section per sport. */
export function weeklyDigestCard(rows: DigestRow[]): AdaptiveCard {
  const totalMatches = rows.reduce((sum, r) => sum + r.matches_played, 0)

  const body: unknown[] = heading(
    "Monday ladder report",
    totalMatches === 0
      ? "Not a single game played last week. Disappointing."
      : `${totalMatches} ${totalMatches === 1 ? "match" : "matches"} played last week`
  )

  for (const row of rows) {
    body.push({
      type: "TextBlock",
      text: row.sport_name,
      weight: "Bolder",
      size: "Default",
      separator: true,
      spacing: "Medium",
      wrap: true,
    })

    if (row.matches_played === 0) {
      body.push({
        type: "TextBlock",
        text: "_No games played._",
        isSubtle: true,
        spacing: "None",
        wrap: true,
      })
      continue
    }

    const facts: { title: string; value: string }[] = []

    if (row.king_name) {
      facts.push({
        title: "King of the hill",
        value: `${row.king_name} — ${row.king_rating} (${row.king_variant})`,
      })
    }
    if (row.climber_name && row.climber_gain !== null) {
      facts.push({
        title: "Biggest climber",
        value: `${row.climber_name} — ${signed(row.climber_gain)} this week`,
      })
    }
    if (row.blunder_name && row.blunder_drop !== null) {
      facts.push({
        title: "Biggest blunder",
        value:
          `${row.blunder_name} — ${signed(row.blunder_drop)} losing ` +
          `${row.blunder_score} to ${row.blunder_opponent} (${row.blunder_variant})`,
      })
    }

    body.push({ type: "FactSet", facts, spacing: "Small" })
  }

  return card(body)
}
