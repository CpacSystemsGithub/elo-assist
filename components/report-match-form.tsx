"use client"

import { useActionState, useMemo, useState } from "react"
import { TrophyIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  previewMatch,
  STARTING_RATING,
  type PlayerRatingState,
} from "@/lib/elo"
import { signed } from "@/lib/format"
import { reportMatch, type ReportMatchState } from "@/lib/actions/match"
import type { GameType, Profile, RatingState, Sport } from "@/lib/types"

type RatingRow = RatingState & { game_type_id: string }

/** The `{ value, label }` shape Combobox reads for filtering and display. */
type OpponentItem = { value: string; label: string }

export function ReportMatchForm({
  sports,
  gameTypes,
  opponents,
  ratings,
  currentUserId,
}: {
  sports: Sport[]
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

  // The score inputs are uncontrolled. Keying them on the last recorded match
  // remounts them empty after a successful report, so the next result starts
  // from a clean scoreline while the opponent and variant stay selected.
  const scoreKey = state.receiptId ?? "new"

  const sportsById = useMemo(
    () => new Map(sports.map((sport) => [sport.id, sport])),
    [sports]
  )

  const opponentItems = useMemo<OpponentItem[]>(
    () =>
      opponents.map((player) => ({
        value: player.id,
        label: player.display_name,
      })),
    [opponents]
  )

  const selectedOpponent =
    opponentItems.find((item) => item.value === opponentId) ?? null

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
    : // Table tennis is win-by-two, foosball win-by-one, so take it from the
      // variant rather than assuming.
      `Game to ${gameType?.points_to_win}${
        gameType?.win_by === 2 ? ", win by two" : ""
      } — enter points, e.g. ${gameType?.points_to_win}–${
        (gameType?.points_to_win ?? 11) - 4
      }.`

  return (
    <form action={formAction}>
      {/* The Selects are controlled React state, so their values ride along as
          hidden inputs rather than native form controls. */}
      <input type="hidden" name="gameTypeId" value={gameTypeId} />
      <input type="hidden" name="opponentId" value={opponentId} />

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
              gameTypes.map((type) => [
                type.id,
                `${sportsById.get(type.sport_id)?.name ?? ""} · ${type.name}`,
              ])
            )}
          >
            <SelectTrigger id="game-type-trigger" className="w-full">
              <SelectValue placeholder="Pick a game" />
            </SelectTrigger>
            {/* alignItemWithTrigger (Base UI's default) anchors the popup to
                the selected item and lets it grow to the viewport height, so
                it ends up covering the rest of the form. Anchoring below the
                trigger with a capped height keeps the buttons underneath
                clickable. */}
            <SelectContent
              alignItemWithTrigger={false}
              align="start"
              className="max-h-64"
            >
              {/* One group per sport, so table tennis and foosball variants
                  that share a name stay tellable apart. */}
              {sports.map((sport) => (
                <SelectGroup key={sport.id}>
                  <SelectLabel>{sport.name}</SelectLabel>
                  {gameTypes
                    .filter((type) => type.sport_id === sport.id)
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {gameType?.description} Each variant has its own rating.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="opponent">Opponent</FieldLabel>
          <Combobox
            items={opponentItems}
            value={selectedOpponent}
            onValueChange={(item) => setOpponentId(item?.value ?? "")}
            // Highlights the top match as you type, so Enter picks it.
            autoHighlight
          >
            <ComboboxInput
              id="opponent"
              placeholder="Who did you play?"
              disabled={opponents.length === 0}
              showClear
            />
            <ComboboxContent>
              <ComboboxEmpty>No player by that name.</ComboboxEmpty>
              <ComboboxList>
                {(item: OpponentItem) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {opponents.length === 0 && (
            <FieldDescription>
              No one else has signed up yet — you need a second player.
            </FieldDescription>
          )}
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

        <FieldDescription>
          {scoreHint} The higher score takes the win.
        </FieldDescription>

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
