import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { supabaseEnv } from "./env"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Never cache this — it is bound to the current request's cookies.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = supabaseEnv()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components can't set cookies. Harmless: proxy.ts refreshes
          // the session on every request, so the cookie is already current.
        }
      },
    },
  })
}

/**
 * The signed-in user, or null. Uses getUser() rather than getSession() so the
 * token is verified against the auth server instead of trusted from a cookie.
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
