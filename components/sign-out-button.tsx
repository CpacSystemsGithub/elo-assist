"use client"

import { LogOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOutIcon data-icon="inline-start" />
        Sign out
      </Button>
    </form>
  )
}
