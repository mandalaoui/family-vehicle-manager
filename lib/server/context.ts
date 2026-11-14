import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@/types/database";
import { pickMembership } from "@/lib/membership";
import { createClient } from "@/utils/supabase/server";

export interface Membership {
  familyId: string;
  familyName: string;
  role: Role;
}

export interface FamilyContext {
  user: User;
  /** Phase 1 UX: a user belongs to one family, so the first membership is used. */
  membership: Membership | null;
}

// getUser() validates the JWT with the Auth server. getSession() is never used for authorization.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getFamilyContext = cache(async (): Promise<FamilyContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: rows } = await supabase.from("family_members").select("family_id, role, created_at").eq("user_id", user.id);
  const member = pickMembership(rows ?? []);
  if (!member) return { user, membership: null };

  const { data: family } = await supabase.from("families").select("id, name").eq("id", member.family_id).maybeSingle();
  if (!family) return { user, membership: null };

  return { user, membership: { familyId: family.id, familyName: family.name, role: member.role } };
});

export interface MemberContext {
  user: User;
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
