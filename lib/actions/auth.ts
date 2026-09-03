"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config"

export interface AuthFormState {
  error?: string
  notice?: string
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "That doesn't look like an email address.",
  })
  .refine((value) => value.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`), {
    message: `You need a @${ALLOWED_EMAIL_DOMAIN} address to join the ladder.`,
  })

const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters."),
  displayName: z
    .string()
    .trim()
    .min(2, "Your name needs at least 2 characters.")
    .max(40, "That name is too long."),
})

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
})

/** Keep post-login redirects on this site. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : ""
  return next.startsWith("/") && !next.startsWith("//") ? next : "/report"
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password, displayName } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })

  if (error) {
    // The database trigger raises on a non-company domain; show the friendly
    // version rather than the raw Postgres message.
    if (/cpacsystems/i.test(error.message)) {
      return {
        error: `You need a @${ALLOWED_EMAIL_DOMAIN} address to join the ladder.`,
      }
    }
    return { error: error.message }
  }

  // With email confirmation switched on, signUp returns no session.
  if (!data.session) {
    return {
      notice: `Almost there — we sent a confirmation link to ${email}. Open it, then sign in.`,
    }
  }

  revalidatePath("/", "layout")
  redirect(safeNext(formData.get("next")))
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: "That email and password don't match. Try again." }
  }

  revalidatePath("/", "layout")
  redirect(safeNext(formData.get("next")))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}
