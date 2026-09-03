"use client"

import Link from "next/link"
import { useActionState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { signIn, signUp, type AuthFormState } from "@/lib/actions/auth"
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config"

export function AuthForm({
  mode,
  next,
}: {
  mode: "signin" | "signup"
  next?: string
}) {
  const isSignUp = mode === "signup"
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    isSignUp ? signUp : signIn,
    {}
  )

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.error && (
          <Alert variant="destructive">
            <AlertTitle>{state.error}</AlertTitle>
          </Alert>
        )}

        {state.notice && (
          <Alert>
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>{state.notice}</AlertDescription>
          </Alert>
        )}

        {next && <input type="hidden" name="next" value={next} />}

        {isSignUp && (
          <Field>
            <FieldLabel htmlFor="displayName">Name</FieldLabel>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Anna Lindqvist"
              required
            />
            <FieldDescription>
              How you appear on the leaderboard.
            </FieldDescription>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
            required
          />
          {isSignUp && (
            <FieldDescription>
              The ladder is open to @{ALLOWED_EMAIL_DOMAIN} addresses only.
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={isSignUp ? 8 : undefined}
            required
          />
          {isSignUp && (
            <FieldDescription>At least 8 characters.</FieldDescription>
          )}
        </Field>

        <Field>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          {isSignUp ? (
            <>
              Already on the ladder? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Create an account</Link>
            </>
          )}
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
