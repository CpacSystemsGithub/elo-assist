"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"

import type { Match } from "@/lib/types"

import { createClient } from "@/lib/supabase/server"
import { announceMatch } from "@/lib/notifications/announce"

export interface ReportMatchState {
  error?: string
  success?: string
  /** Id of the match just recorded. Changes on every successful report, which
   *  is what lets the form clear the scoreline for the next one. */
  receiptId?: string
}

const reportSchema = z
  .object({
    gameTypeId: z.uuid("Pick a game type."),
    opponentId: z.uuid("Pick an opponent."),
    yourScore: z.coerce.number().int().min(0).max(99),
    opponentScore: z.coerce.number().int().min(0).max(99),
  })
  // The winner is read off the scoreline, so a draw has no result to record.
  .refine((values) => values.yourScore !== values.opponentScore, {
    message: "Scores can't be level — someone has to win.",
  })

export async function reportMatch(
  _prevState: ReportMatchState,
  formData: FormData
): Promise<ReportMatchState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Your session expired. Sign in again to report a match." }
  }

  const parsed = reportSchema.safeParse({
    gameTypeId: formData.get("gameTypeId"),
    opponentId: formData.get("opponentId"),
    yourScore: formData.get("yourScore"),
    opponentScore: formData.get("opponentScore"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { gameTypeId, opponentId, yourScore, opponentScore } = parsed.data

  if (opponentId === user.id) {
    return { error: "You can't play yourself." }
  }

  const youWon = yourScore > opponentScore

  // report_match() re-checks every one of these server-side; sending winner and
  // loser explicitly just keeps the RPC signature unambiguous.
  const { data, error } = await supabase.rpc("report_match", {
    p_game_type_id: gameTypeId,
    p_winner_id: youWon ? user.id : opponentId,
    p_loser_id: youWon ? opponentId : user.id,
    p_winner_score: youWon ? yourScore : opponentScore,
    p_loser_score: youWon ? opponentScore : yourScore,
  })

  if (error) {
    return { error: error.message }
  }

  // Announce after the response is sent, so a slow or unreachable Teams
  // webhook never delays the person reporting the result.
  const recorded = data as Match | null
  if (recorded) after(() => announceMatch(recorded))

  revalidatePath("/")
  revalidatePath("/report")

  return {
    success: youWon
      ? "Nice one — result recorded and the board is updated."
      : "Result recorded. Get them next time.",
    receiptId: (data as { id?: string } | null)?.id,
  }
}
