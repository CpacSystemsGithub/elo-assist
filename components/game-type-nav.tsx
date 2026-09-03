import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { GameType } from "@/lib/types"

/**
 * Switches the board between variants of the selected sport. Plain links
 * rather than a Tabs widget: each combination is its own URL, so the wall
 * screen can be pointed at one and stay there across refreshes.
 */
export function GameTypeNav({
  gameTypes,
  activeSlug,
  sportSlug,
}: {
  gameTypes: GameType[]
  activeSlug: string
  sportSlug: string
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
            // Renders an <a>, so Base UI must drop native button semantics.
            nativeButton={false}
            render={
              <Link href={`/?sport=${sportSlug}&game=${gameType.slug}`} />
            }
          >
            {gameType.name}
          </Button>
        )
      })}
    </nav>
  )
}
