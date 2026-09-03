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
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config"

export const metadata = { title: "Create account" }

export default async function SignUpPage({
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
          <CardTitle>Join the ladder</CardTitle>
          <CardDescription>
            Open to everyone with a @{ALLOWED_EMAIL_DOMAIN} address. You start
            at 1000 in every variant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="signup" next={next} />
        </CardContent>
      </Card>
    </main>
  )
}
