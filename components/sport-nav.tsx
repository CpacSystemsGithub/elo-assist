import Link from "next/link"

import { cn } from "@/lib/utils"
import type { Sport } from "@/lib/types"

/**
 * Top-level switch between the two tables. Each sport keeps the identical
 * layout below it — only the ratings underneath differ.
 */
export function SportNav({
  sports,
  activeSlug,
}: {
  sports: Sport[]
  activeSlug: string
}) {
  return (
    <nav
      aria-label="Sport"
      className="inline-flex items-center gap-1 rounded-xl border bg-muted/40 p-1"
    >
      {sports.map((sport) => {
        const isActive = sport.slug === activeSlug
        return (
          <Link
            key={sport.id}
            href={`/?sport=${sport.slug}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {sport.name}
          </Link>
        )
      })}
    </nav>
  )
}
