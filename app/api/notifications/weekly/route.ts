import { NextResponse, type NextRequest } from "next/server"

import { weeklyDigestCard, type DigestRow } from "@/lib/notifications/cards"
import { isTeamsConfigured, postToTeams } from "@/lib/notifications/teams"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** ISO week key, e.g. 2026-W36 — the digest is claimed once per week. */
function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  // Thursday of the current week decides the ISO year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/**
 * The Monday round-up, called by the pg_cron job in
 * supabase/migrations/0003_notifications.sql.
 *
 * Guarded by a shared secret because it posts to a company channel, and
 * claimed once per ISO week so a cron retry can't post it twice.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    )
  }

  if (request.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isTeamsConfigured()) {
    return NextResponse.json(
      { error: "No Teams webhook is configured" },
      { status: 500 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("weekly_digest", {
    p_since: new Date(Date.now() - 7 * 86400000).toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as DigestRow[]

  // `?force=1` re-sends the same week — handy when testing the wiring.
  if (request.nextUrl.searchParams.get("force") !== "1") {
    const { data: claimed } = await supabase.rpc("claim_notification", {
      p_kind: "weekly",
      p_key: isoWeekKey(new Date()),
    })
    if (claimed !== true) {
      return NextResponse.json({ skipped: "already sent this week" })
    }
  }

  // Each sport gets its own round-up in its own channel.
  const results = await Promise.all(
    rows.map((row) => postToTeams(weeklyDigestCard([row]), row.sport_slug))
  )
  const delivered = results.length > 0 && results.every(Boolean)

  return NextResponse.json(
    { delivered, sports: rows.length },
    { status: delivered ? 200 : 502 }
  )
}
