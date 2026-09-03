import { cn } from "@/lib/utils"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { signed, timeAgo } from "@/lib/format"
import type { MatchWithNames } from "@/lib/types"

export function RecentMatches({ matches }: { matches: MatchWithNames[] }) {
  if (matches.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nothing played yet</EmptyTitle>
          <EmptyDescription>
            Results show up here as they come in.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul className="flex flex-col">
      {matches.map((match) => {
        const swing = match.winner_rating_after - match.winner_rating_before
        // A big swing means the underdog won — worth calling out on the board.
        const wasUpset = match.winner_rating_before < match.loser_rating_before

        return (
          <li
            key={match.id}
            className="flex items-baseline gap-2 border-b py-2.5 text-sm last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="font-medium">{match.winner_name}</span>
                <span className="text-muted-foreground"> beat </span>
                <span className="font-medium">{match.loser_name}</span>
                <span className="ml-1.5 font-mono text-muted-foreground tabular-nums">
                  {match.winner_score}–{match.loser_score}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {timeAgo(match.played_at)}
                {wasUpset && (
                  <span className="ml-1.5 font-medium text-amber-600 dark:text-amber-400">
                    upset
                  </span>
                )}
              </p>
            </div>

            <span
              className={cn(
                "shrink-0 font-mono text-sm font-semibold tabular-nums",
                "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {signed(swing)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
