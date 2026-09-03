import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PROVISIONAL_MATCHES } from "@/lib/elo"
import type { LeaderboardRow } from "@/lib/types"

/** Last few results per player, newest first. */
export type FormGuide = Record<string, ("W" | "L")[]>

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  2: "bg-zinc-400/15 text-zinc-600 dark:text-zinc-300",
  3: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
}

export function LeaderboardTable({
  rows,
  form,
  highlightPlayerId,
}: {
  rows: LeaderboardRow[]
  form: FormGuide
  highlightPlayerId?: string
}) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No one has played this variant yet</EmptyTitle>
          <EmptyDescription>
            The first result reported here sets the ladder in motion.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 text-center">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="w-28 text-right">Rating</TableHead>
          <TableHead className="w-24 text-right">W–L</TableHead>
          <TableHead className="w-32 text-right">Form</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isProvisional = row.matches_played < PROVISIONAL_MATCHES
          return (
            <TableRow
              key={row.player_id}
              className={cn(
                highlightPlayerId === row.player_id && "bg-primary/5"
              )}
            >
              <TableCell className="text-center">
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    RANK_STYLES[row.rank] ?? "text-muted-foreground"
                  )}
                >
                  {row.rank}
                </span>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-medium">
                    {row.display_name}
                  </span>
                  {isProvisional && (
                    <Badge variant="secondary" className="shrink-0">
                      Provisional
                    </Badge>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-right font-mono text-lg font-semibold tabular-nums">
                {row.rating}
              </TableCell>

              <TableCell className="text-right text-muted-foreground tabular-nums">
                {row.wins}–{row.losses}
              </TableCell>

              <TableCell>
                <FormDots results={form[row.player_id] ?? []} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function FormDots({ results }: { results: ("W" | "L")[] }) {
  if (results.length === 0) {
    return <span className="block text-right text-muted-foreground">—</span>
  }

  return (
    <div
      className="flex justify-end gap-1"
      aria-label={`Recent results, newest first: ${results.join(", ")}`}
    >
      {results.map((result, index) => (
        <span
          key={index}
          aria-hidden
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold",
            result === "W"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {result}
        </span>
      ))}
    </div>
  )
}
