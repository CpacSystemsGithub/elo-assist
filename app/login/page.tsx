import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth-form"
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
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

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
          <AuthForm mode="signin" next={next} />
        </CardContent>
      </Card>
    </main>
  )
}
