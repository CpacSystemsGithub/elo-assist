import "server-only"

/**
 * Posting to Microsoft Teams.
 *
 * TEAMS_WEBHOOK_URL is the URL of a Teams "Workflows" (Power Automate) trigger
 * — "When a Teams webhook request is received". If it is unset, notifications
 * are silently skipped, so the ladder works fine before anyone wires Teams up.
 */

/** Minimal Adaptive Card shape — enough for the cards this app sends. */
export interface AdaptiveCard {
  type: "AdaptiveCard"
  $schema: string
  version: string
  body: unknown[]
}

export function isTeamsConfigured(): boolean {
  return Boolean(process.env.TEAMS_WEBHOOK_URL)
}

/**
 * Send one card. Never throws: a broken webhook must not take down match
 * reporting or the digest route. Returns whether it was delivered.
 */
export async function postToTeams(card: AdaptiveCard): Promise<boolean> {
  const url = process.env.TEAMS_WEBHOOK_URL
  if (!url) return false

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
