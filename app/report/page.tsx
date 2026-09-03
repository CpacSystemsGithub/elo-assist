import { redirect } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReportMatchForm } from "@/components/report-match-form"
import { SetupNotice } from "@/components/setup-notice"
import {
  getAllRatings,
  getGameTypes,
  getOpponents,
  getProfile,
} from "@/lib/queries"
import { getCurrentUser } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const metadata = { title: "Report a match" }

export default async function ReportPage() {
  const user = await getCurrentUser().catch(() => null)

  // proxy.ts already guards this route; this is the belt to its braces.
  if (!user) redirect("/login?next=%2Freport")

  let gameTypes, opponents, ratings, profile
  try {
    ;[gameTypes, opponents, ratings, profile] = await Promise.all([
      getGameTypes(),
      getOpponents(user.id),
      getAllRatings(),
      getProfile(user.id),
    ])
  } catch (error) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <SetupNotice detail={(error as Error).message} />
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Report a match</CardTitle>
          <CardDescription>
            {profile ? `Signed in as ${profile.display_name}. ` : ""}
            Ratings update the moment you submit, so log it while you remember
            the score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportMatchForm
            gameTypes={gameTypes}
            opponents={opponents}
            ratings={ratings}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </main>
  )
}
