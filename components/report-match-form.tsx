"use client"

import { useActionState, useMemo, useState } from "react"
import { TrophyIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  previewMatch,
  STARTING_RATING,
  type PlayerRatingState,
} from "@/lib/elo"
import { signed } from "@/lib/format"
import { reportMatch, type ReportMatchState } from "@/lib/actions/match"
import type { GameType, Profile, RatingState } from "@/lib/types"

type RatingRow = RatingState & { game_type_id: string }

export function ReportMatchForm({
  gameTypes,
  opponents,
  ratings,
  currentUserId,
}: {
  gameTypes: GameType[]
  opponents: Profile[]
  ratings: RatingRow[]
  currentUserId: string
}) {
  const [state, formAction, pending] = useActionState<
    ReportMatchState,
    FormData
  >(reportMatch, {})

  const [gameTypeId, setGameTypeId] = useState(gameTypes[0]?.id ?? "")
  const [opponentId, setOpponentId] = useState("")
  const [outcome, setOutcome] = useState<"win" | "loss">("win")

  // The score inputs are uncontrolled. Keying them on the last recorded match
  // remounts them empty after a successful report, so the next result starts
  // from a clean scoreline while the opponent and variant stay selected.
  const scoreKey = state.receiptId ?? "new"

  const gameType = gameTypes.find((type) => type.id === gameTypeId)
  const isSeries = (gameType?.sets_to_win ?? 1) > 1

  const ratingLookup = useMemo(() => {
    const map = new Map<string, RatingRow>()
    for (const row of ratings) {
      map.set(`${row.player_id}:${row.game_type_id}`, row)
    }
    return map
  }, [ratings])

  /** Bridges the snake_case database row to the Elo module's shape. A player
   *  with no row yet is unrated in this variant, so they start from scratch. */
  function ratingFor(playerId: string): PlayerRatingState {
    const row = ratingLookup.get(`${playerId}:${gameTypeId}`)
    return row
      ? { rating: row.rating, matchesPlayed: row.matches_played }
      : { rating: STARTING_RATING, matchesPlayed: 0 }
  }

  const preview =
    gameType && opponentId
      ? previewMatch(
          ratingFor(currentUserId),
          ratingFor(opponentId),
          gameType.k_factor
        )
      : null

  const opponentName =
    opponents.find((player) => player.id === opponentId)?.display_name ??
    "your opponent"

  const scoreLabel = isSeries ? "Sets" : "Points"
  const scoreHint = isSeries
    ? `First to ${gameType?.sets_to_win} sets — enter sets won, e.g. ${gameType?.sets_to_win}–1.`
    : `Game to ${gameType?.points_to_win}, win by two — enter points, e.g. ${gameType?.points_to_win}–7.`

  return (
    <form action={formAction}>
      {/* The Selects and the toggle are controlled React state, so their values
          ride along as hidden inputs rather than native form controls. */}
      <input type="hidden" name="gameTypeId" value={gameTypeId} />
      <input type="hidden" name="opponentId" value={opponentId} />
      <input type="hidden" name="didWin" value={outcome} />

      <FieldGroup>
        {state.error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t record that</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {state.success && (
          <Alert>
            <TrophyIcon />
            <AlertTitle>{state.success}</AlertTitle>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="game-type-trigger">Game type</FieldLabel>
          <Select
            value={gameTypeId}
            onValueChange={(value) => setGameTypeId(value as string)}
            items={Object.fromEntries(
              gameTypes.map((type) => [type.id, type.name])
            )}
          >
            <SelectTrigger id="game-type-trigger" className="w-full">
              <SelectValue placeholder="Pick a variant" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {gameTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {gameType?.description} Each variant has its own rating.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="opponent-trigger">Opponent</FieldLabel>
          <Select
            value={opponentId}
            onValueChange={(value) => setOpponentId(value as string)}
            items={Object.fromEntries(
              opponents.map((player) => [player.id, player.display_name])
            )}
          >
            <SelectTrigger id="opponent-trigger" className="w-full">
              <SelectValue placeholder="Who did you play?" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {opponents.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.display_name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {opponents.length === 0 && (
            <FieldDescription>
              No one else has signed up yet — you need a second player.
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="outcome">Result</FieldLabel>
          <ToggleGroup
            id="outcome"
            variant="outline"
            value={[outcome]}
            onValueChange={(value) => {
              // Single-select: Base UI hands back an array; ignore deselection
              // so there is always an outcome chosen.
              const next = (value as string[])[0]
              if (next === "win" || next === "loss") setOutcome(next)
            }}
          >
            <ToggleGroupItem value="win">I won</ToggleGroupItem>
            <ToggleGroupItem value="loss">I lost</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="yourScore">
              Your {scoreLabel.toLowerCase()}
            </FieldLabel>
            <Input
              key={scoreKey}
              id="yourScore"
              name="yourScore"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              defaultValue=""
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="opponentScore">
              Their {scoreLabel.toLowerCase()}
            </FieldLabel>
            <Input
              key={scoreKey}
              id="opponentScore"
              name="opponentScore"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              defaultValue=""
              required
            />
          </Field>
        </div>

        <FieldDescription>{scoreHint}</FieldDescription>

        {preview && (
          <StakesPreview preview={preview} opponentName={opponentName} />
        )}

        <Field>
          <Button type="submit" disabled={pending || opponents.length === 0}>
            {pending && <Spinner data-icon="inline-start" />}
            Record result
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

/** "Here's what this match is worth" — the point of an Elo ladder made visible. */
function StakesPreview({
  preview,
  opponentName,
}: {
  preview: ReturnType<typeof previewMatch>
  opponentName: string
}) {
  const chance = Math.round(preview.winProbability * 100)

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="mb-2 text-sm font-medium">
        At stake against {opponentName}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Win </span>
          <span className="font-mono font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            {signed(preview.winDelta)}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Lose </span>
          <span className="font-mono font-semibold text-destructive tabular-nums">
            {signed(preview.lossDelta)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Rated chance to win{" "}
          <span className="font-mono text-foreground tabular-nums">
            {chance}%
          </span>
        </span>
      </div>
    </div>
  )
}
