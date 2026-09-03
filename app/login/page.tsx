import { redirect } from "next/navigation"

import { TriangleAlertIcon } from "lucide-react"

import { AuthForm } from "@/components/auth-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentUser } from "@/lib/supabase/server"

export const metadata = { title: "Sign in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  if (await getCurrentUser().catch(() => null)) {
    redirect(next ?? "/report")
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Report your results and climb the ladder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Set by /auth/confirm when a confirmation link has already been
              used or has expired. */}
          {error === "confirmation" && (
            <Alert variant="destructive" className="mb-5">
              <TriangleAlertIcon />
              <AlertTitle>That confirmation link didn&apos;t work</AlertTitle>
              <AlertDescription>
                It may have expired or already been used. Sign in below, or sign
                up again to get a fresh link.
              </AlertDescription>
            </Alert>
          )}
          <AuthForm mode="signin" next={next} />
        </CardContent>
      </Card>
    </main>
  )
}
