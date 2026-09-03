"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Keeps the wall screen current without anyone touching it.
 * Server Components re-run on refresh, so the board reflects new results.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])

  return null
}
