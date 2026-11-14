"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage } from "@/lib/errors";
import { fail, isSession, NOT_SIGNED_IN, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { getFamilyContext } from "@/lib/server/context";
import { rateLimited } from "@/lib/server/rate-limit";
import { emailSchema, familyNameSchema, roleSchema, tokenSchema, uuidSchema } from "@/lib/validation";
import { createClient } from "@/utils/supabase/server";

const FORBIDDEN = "אין לך הרשאה לבצע את הפעולה.";
const ALREADY_IN_FAMILY = "החשבון הזה כבר חבר במשפחה. כדי להצטרף למשפחה אחרת, עזבו קודם את המשפחה הנוכחית בהגדרות.";

export async function createFamily(name: string): Promise<ActionResult> {
  const ctx = await getFamilyContext();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (ctx.membership) return fail("כבר יש לך משפחה בחשבון הזה.");

  const parsed = familyNameSchema.safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { name: parsed.error.issues[0].message });
  if (rateLimited(`create_family:${ctx.user.id}`, 3, 3_600_000)) return fail("יותר מדי ניסיונות ליצור משפחה. נסו שוב מאוחר יותר.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_family", { p_name: parsed.data });
  if (error) return fail(dbErrorMessage(error, "create_family"));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  const ctx = await getFamilyContext();
  if (!ctx) return fail(NOT_SIGNED_IN);
  // One family per user in the app UX: a second membership would be invisible to the user.
  if (ctx.membership) return fail(ALREADY_IN_FAMILY);
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: parsed.data });
  if (error) return fail(dbErrorMessage(error, "accept_invitation"));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameFamily(name: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail(FORBIDDEN);

  const parsed = familyNameSchema.safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { name: parsed.error.issues[0].message });

  const { data, error } = await s.supabase.from("families").update({ name: parsed.data }).eq("id", s.familyId).select("id");
  if (error) return fail(dbErrorMessage(error, "rename_family"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changeMemberRole(userId: string, role: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail(FORBIDDEN);

  const id = uuidSchema.safeParse(userId);
  const r = roleSchema.safeParse(role);
  if (!id.success || !r.success) return fail("הבקשה לא תקינה. רעננו את הדף ונסו שוב.");

  const { data, error } = await s.supabase
    .from("family_members")
    .update({ role: r.data })
    .eq("family_id", s.familyId)
    .eq("user_id", id.data)
    .select("user_id");
  if (error) return fail(dbErrorMessage(error, "change_role"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail(FORBIDDEN);

  const id = uuidSchema.safeParse(userId);
  if (!id.success) return fail("הבקשה לא תקינה. רעננו את הדף ונסו שוב.");

  const { data, error } = await s.supabase
    .from("family_members")
    .delete()
    .eq("family_id", s.familyId)
    .eq("user_id", id.data)
    .select("user_id");
  if (error) return fail(dbErrorMessage(error, "remove_member"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidatePath("/settings");
  return { ok: true };
}

/** Any member may leave. The last admin cannot (DB trigger raises last_admin). */
export async function leaveFamily(): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);

  const { error } = await s.supabase.from("family_members").delete().eq("family_id", s.familyId).eq("user_id", s.userId);
  if (error) return fail(dbErrorMessage(error, "leave_family"));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createInvitation(email: string, role: string): Promise<ActionResult<{ token: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail(FORBIDDEN);

  const e = emailSchema.safeParse(email);
  if (!e.success) return fail(e.error.issues[0].message, { email: e.error.issues[0].message });
  const r = roleSchema.safeParse(role);
  if (!r.success) return zodFail(r.error);

  const { data, error } = await s.supabase.rpc("create_invitation", { p_family_id: s.familyId, p_email: e.data, p_role: r.data });
  if (error) {
    const message = dbErrorMessage(error, "create_invitation");
    return fail(message, { email: message });
  }
  revalidatePath("/settings");
  return { ok: true, token: data };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail(FORBIDDEN);

  const id = uuidSchema.safeParse(invitationId);
  if (!id.success) return fail("הבקשה לא תקינה. רעננו את הדף ונסו שוב.");

  const { error } = await s.supabase.rpc("revoke_invitation", { p_invitation_id: id.data });
  if (error) return fail(dbErrorMessage(error, "revoke_invitation"));
  revalidatePath("/settings");
  return { ok: true };
}
