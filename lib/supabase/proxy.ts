import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { supabaseEnv } from "./env"

/** Routes that require a signed-in player. Everything else is public so the
 *  wall screen can show the leaderboard without logging in. */
const PROTECTED_PREFIXES = ["/report"]

/**
 * Refreshes the Supabase auth cookie on every request and bounces signed-out
 * visitors away from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  let url: string
  let key: string
  try {
    ;({ url, key } = supabaseEnv())
  } catch {
    // Not configured yet. The proxy runs ahead of every page, so throwing here
    // would turn the whole site into a 500 with no explanation. Pass the
    // request through instead and let the page render its setup instructions.
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Do not remove: this call is what refreshes an expired token, and the
  // refreshed cookie is written onto `response` by setAll above.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (!user && needsAuth) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  return response
}
