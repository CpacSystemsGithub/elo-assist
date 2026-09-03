import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AutoRefresh } from "@/components/auto-refresh"
import { GameTypeNav } from "@/components/game-type-nav"
import { SportNav } from "@/components/sport-nav"
import {
  LeaderboardTable,
  type FormGuide,
} from "@/components/leaderboard-table"
import { RecentMatches } from "@/components/recent-matches"
import { SetupNotice } from "@/components/setup-notice"
import {
  getGameTypes,
  getLeaderboard,
  getRecentMatches,
  getSports,
} from "@/lib/queries"
import { getCurrentUser } from "@/lib/supabase/server"
import type { MatchWithNames } from "@/lib/types"

// The board must always show the live standings, never a cached snapshot.
export const dynamic = "force-dynamic"

/** Most recent five results per player, newest first. */
function buildFormGuide(matches: MatchWithNames[]): FormGuide {
  const form: FormGuide = {}

  // `matches` arrives newest first, so appending preserves that order.
  for (const match of matches) {
    for (const [playerId, result] of [
      [match.winner_id, "W"] as const,
      [match.loser_id, "L"] as const,
    ]) {
      const existing = (form[playerId] ??= [])
      if (existing.length < 5) existing.push(result)
    }
  }

  return form
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; game?: string }>
}) {
  const { sport, game } = await searchParams

  let sports, allGameTypes
  try {
    ;[sports, allGameTypes] = await Promise.all([getSports(), getGameTypes()])
  } catch (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <SetupNotice detail={(error as Error).message} />
      </main>
    )
  }

  if (sports.length === 0 || allGameTypes.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <SetupNotice detail="No sports or game types found — run the migrations in supabase/migrations/." />
      </main>
    )
  }

  const activeSport = sports.find((s) => s.slug === sport) ?? sports[0]

  // Variant slugs are only unique within a sport, so scope before matching.
  const gameTypes = allGameTypes.filter((t) => t.sport_id === activeSport.id)
  const activeGameType = gameTypes.find((t) => t.slug === game) ?? gameTypes[0]

  if (!activeGameType) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <SetupNotice
          detail={`${activeSport.name} has no active variants. Add one to game_types.`}
        />
      </main>
    )
  }

  const [rows, matches, user] = await Promise.all([
    getLeaderboard(activeGameType.id),
    getRecentMatches(activeGameType.id),
    getCurrentUser().catch(() => null),
  ])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <AutoRefresh seconds={30} />

      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <SportNav sports={sports} activeSlug={activeSport.slug} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {activeGameType.description}
          </p>
          <GameTypeNav
            gameTypes={gameTypes}
            activeSlug={activeGameType.slug}
            sportSlug={activeSport.slug}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {activeSport.name} · {activeGameType.name}
            </CardTitle>
            <CardDescription>
              Every variant of every sport is rated separately. Ratings start at
              1000 and move by how surprising each result was.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeaderboardTable
              rows={rows}
              form={buildFormGuide(matches)}
              highlightPlayerId={user?.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent results</CardTitle>
            <CardDescription>
              {activeSport.name} · {activeGameType.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentMatches matches={matches.slice(0, 15)} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
