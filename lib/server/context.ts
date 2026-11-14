import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/types/database";
import { pickMembership } from "@/lib/membership";
import { createClient } from "@/utils/supabase/server";

export interface Membership {
  familyId: string;
  familyName: string;
  role: Role;
}

/** The few user fields the app needs. Built either from a verified JWT or from the Auth server. */
export interface SessionUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
}

export interface FamilyContext {
  user: SessionUser;
  /** One family per user in the UX: the oldest membership is used. */
  membership: Membership | null;
}

/**
 * Pages and server components: the JWT signature and expiry are verified locally with the project's
 * public signing keys (getClaims), so no Auth-server round trip. The proxy still calls getUser() on every
 * request, and every database query is checked by RLS with the same JWT.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
});

/** Server Actions (writes): ask the Auth server, so a revoked session is rejected immediately. */
export const getVerifiedUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null, user_metadata: (user.user_metadata as Record<string, unknown>) ?? {} };
});

async function loadMembership(userId: string): Promise<Membership | null> {
  const supabase = await createClient();
  // One round trip: membership rows with their family embedded.
  const { data: rows } = await supabase.from("family_members").select("family_id, role, created_at, families(id, name)").eq("user_id", userId);
  const member = pickMembership(rows ?? []);
  if (!member || !member.families) return null;
  return { familyId: member.families.id, familyName: member.families.name, role: member.role };
}

export const getFamilyContext = cache(async (): Promise<FamilyContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, membership: await loadMembership(user.id) };
});

/** Same as getFamilyContext, but the user is verified with the Auth server (used by Server Actions). */
export const getVerifiedFamilyContext = cache(async (): Promise<FamilyContext | null> => {
  const user = await getVerifiedUser();
  if (!user) return null;
  return { user, membership: await loadMembership(user.id) };
});

export interface MemberContext {
  user: SessionUser;
  membership: Membership;
}

/**
 * For pages inside the app: the signed-in user with a family. Anyone else is redirected instead of
 * crashing (no session -> /login, no family -> /onboarding), even if the layout guard runs in parallel.
 */
export async function requireMembership(): Promise<MemberContext> {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (!ctx.membership) redirect("/onboarding");
  return { user: ctx.user, membership: ctx.membership };
}
