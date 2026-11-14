import type { ZodError } from "zod";
import { getFamilyContext } from "./context";
import { createClient } from "@/utils/supabase/server";
import type { Role } from "@/types/database";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const NOT_SIGNED_IN = "ההתחברות פגה. התחברו שוב.";
export const NO_FAMILY = "לא נמצאה משפחה לחשבון הזה.";

export function fail(error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors };
}

export function zodFail(err: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  const only = Object.keys(fieldErrors).length === 1 && "_" in fieldErrors ? fieldErrors._ : undefined;
  return fail(only ?? "יש לתקן את השדות המסומנים.", fieldErrors);
}

export interface Session {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  familyId: string;
  role: Role;
}

/**
 * Authenticates with getUser() and derives the family + role from the database.
 * Nothing about the family or role is ever read from the client.
 */
export async function requireSession(): Promise<Session | { error: string }> {
  const ctx = await getFamilyContext();
  if (!ctx) return { error: NOT_SIGNED_IN };
  if (!ctx.membership) return { error: NO_FAMILY };
  const supabase = await createClient();
  return { supabase, userId: ctx.user.id, familyId: ctx.membership.familyId, role: ctx.membership.role };
}

export function isSession(s: Session | { error: string }): s is Session {
  return !("error" in s);
}
