import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { GameType } from "@/lib/types"

/**
 * Switches the board between table-tennis variants. Plain links rather than a
 * Tabs widget: each variant is its own URL, so the wall screen can be pointed
 * straight at /?game=best-of-5 and stay there across refreshes.
 */
export function GameTypeNav({
  gameTypes,
  activeSlug,
}: {
  gameTypes: GameType[]
  activeSlug: string
}) {
  return (
    <nav aria-label="Game type" className="flex flex-wrap gap-1.5">
      {gameTypes.map((gameType) => {
        const isActive = gameType.slug === activeSlug
        return (
          <Button
            key={gameType.id}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            aria-current={isActive ? "page" : undefined}
            className={cn(!isActive && "text-muted-foreground")}
            render={<Link href={`/?game=${gameType.slug}`} />}
          >
            {gameType.name}
          </Button>
        )
      })}
    </nav>
  )
}
