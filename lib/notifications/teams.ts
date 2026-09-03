import "server-only"

/**
 * Posting to Microsoft Teams.
 *
 * Each sport posts to its own channel: TEAMS_WEBHOOK_URL_PINGPONG for table
 * tennis, TEAMS_WEBHOOK_URL_FUSSBALL for foosball, with TEAMS_WEBHOOK_URL as a
 * fallback for both. Each is the URL of a Teams "Workflows" (Power Automate)
 * trigger — "When a Teams webhook request is received". With none set,
 * notifications are silently skipped, so the ladder works fine before anyone
 * wires Teams up.
 */

/** Minimal Adaptive Card shape — enough for the cards this app sends. */
export interface AdaptiveCard {
  type: "AdaptiveCard"
  $schema: string
  version: string
  body: unknown[]
}

const WEBHOOK_ENV_BY_SPORT: Record<string, string> = {
  "table-tennis": "TEAMS_WEBHOOK_URL_PINGPONG",
  foosball: "TEAMS_WEBHOOK_URL_FUSSBALL",
}

function webhookUrl(sportSlug?: string): string | undefined {
  const envName = sportSlug ? WEBHOOK_ENV_BY_SPORT[sportSlug] : undefined
  const perSport = envName ? process.env[envName] : undefined
  return perSport || process.env.TEAMS_WEBHOOK_URL
}

/** Without a sport, this asks whether *any* channel is wired up. */
export function isTeamsConfigured(sportSlug?: string): boolean {
  if (sportSlug) return Boolean(webhookUrl(sportSlug))
  return (
    Boolean(process.env.TEAMS_WEBHOOK_URL) ||
    Object.values(WEBHOOK_ENV_BY_SPORT).some((name) => process.env[name])
  )
}

/**
 * Send one card to the channel for `sportSlug`. Never throws: a broken webhook
 * must not take down match reporting or the digest route. Returns whether it
 * was delivered.
 */
export async function postToTeams(
  card: AdaptiveCard,
  sportSlug?: string
): Promise<boolean> {
  const url = webhookUrl(sportSlug)
  if (!url) {
    console.warn(`No Teams webhook configured for sport "${sportSlug ?? ""}".`)
    return false
  }

  // The envelope Teams Workflows expects around an Adaptive Card.
  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: card,
      },
    ],
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.error(
        `Teams webhook returned ${response.status}: ${(await response.text()).slice(0, 300)}`
      )
      return false
    }
    return true
  } catch (error) {
    console.error("Teams webhook failed:", error)
    return false
  }
}
