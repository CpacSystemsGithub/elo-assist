import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

/** Keep the post-confirmation redirect on this site. */
function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/report"
}

/**
 * Where the link in a Supabase confirmation email lands.
 *
 * Supabase sends the mail; this exchanges the one-time token in the link for a
 * real session cookie, so the new player arrives signed in instead of being
 * asked to log in again. Requires the "Confirm signup" email template to point
 * here — see the README.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNext(searchParams.get("next"))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    // redirect() throws to signal the redirect, so it must sit outside the
    // error check rather than inside a try block.
    if (!error) redirect(next)
  }

  redirect("/login?error=confirmation")
}
