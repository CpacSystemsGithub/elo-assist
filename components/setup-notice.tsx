import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TriangleAlertIcon } from "lucide-react"

/** Shown when the app can't reach Supabase or the schema isn't installed. */
export function SetupNotice({ detail }: { detail: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>
        The ladder isn&apos;t connected to its database yet
      </AlertTitle>
      <AlertDescription>
        <p>
          Create a Supabase project, copy{" "}
          <code className="font-mono">.env.local.example</code> to{" "}
          <code className="font-mono">.env.local</code> with its URL and anon
          key, then run{" "}
          <code className="font-mono">supabase/migrations/0001_init.sql</code>{" "}
          in the Supabase SQL editor. Full steps are in the README.
        </p>
        <p className="text-xs opacity-80">{detail}</p>
      </AlertDescription>
    </Alert>
  )
}
