/**
 * Shared constants. Deliberately not in lib/actions/auth.ts: a "use server"
 * module may only export async functions, so a plain const there breaks every
 * export in the file.
 */

/** Only addresses at this domain can create an account. The rule is also
 *  enforced by a trigger on auth.users, so it holds even if someone calls the
 *  Supabase auth API directly. */
export const ALLOWED_EMAIL_DOMAIN = "cpacsystems.se"
