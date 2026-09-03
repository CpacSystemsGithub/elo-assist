import Link from "next/link"
import { PlusIcon, TrophyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/sign-out-button"
import { getCurrentUser } from "@/lib/supabase/server"

export async function SiteHeader() {
  let signedIn = false

  try {
    signedIn = Boolean(await getCurrentUser())
  } catch {
    // Supabase not configured yet — render the signed-out header so the
    // setup instructions on the home page are still reachable.
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <TrophyIcon className="size-5 text-primary" />
          <span>CPAC Ping Pong</span>
        </Link>

        <div className="flex-1" />

        {/* These render as <a>, not <button>, so Base UI needs
            nativeButton={false} to drop the native button semantics. */}

        {signedIn ? (
          <>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/report" />}
            >
              <PlusIcon data-icon="inline-start" />
              Report a match
            </Button>
            <SignOutButton />
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/signup" />}
            >
              Create account
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
