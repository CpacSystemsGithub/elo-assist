const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
]

/** "3 minutes ago", "yesterday", ... */
export function timeAgo(isoDate: string, now: Date = new Date()): string {
  const seconds = (new Date(isoDate).getTime() - now.getTime()) / 1000

  for (const [unit, unitSeconds] of UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return RELATIVE.format(Math.round(seconds / unitSeconds), unit)
    }
  }

  return "just now"
}

/** Rating changes always read with an explicit sign: +14, -9. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}
