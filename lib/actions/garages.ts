"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage } from "@/lib/errors";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { garageSchema, uuidSchema, type GarageInput } from "@/lib/validation";

const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";
const NOT_FOUND = "המוסך לא נמצא. ייתכן שהוא נמחק.";
const DUPLICATE = "מוסך בשם הזה כבר קיים ברשימה.";

function revalidate() {
  revalidatePath("/garages");
  revalidatePath("/vehicles", "layout");
}

function garageError(error: { code?: string; message?: string }, context: string) {
  if (error.code === "23505") return fail(DUPLICATE, { name: DUPLICATE });
  return fail(dbErrorMessage(error, context));
}

/** Any family member may add a garage. family_id comes from the database membership, never the client. */
export async function createGarage(input: GarageInput): Promise<ActionResult<{ id: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const parsed = garageSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data, error } = await s.supabase
    .from("garages")
    .insert({ ...parsed.data, family_id: s.familyId, created_by: s.userId })
    .select("id")
    .single();
  if (error) return garageError(error, "create_garage");
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateGarage(id: string, input: GarageInput): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const gid = uuidSchema.safeParse(id);
  if (!gid.success) return fail(BAD_REQUEST);
  const parsed = garageSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data, error } = await s.supabase.from("garages").update(parsed.data).eq("id", gid.data).eq("family_id", s.familyId).select("id");
  if (error) return garageError(error, "update_garage");
  if (!data?.length) return fail(NOT_FOUND);
  revalidate();
  return { ok: true };
}

/** Admins only (RLS enforces it too). Service logs keep the garage name as text; only the link is dropped. */
export async function deleteGarage(id: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail("מחיקת מוסך פתוחה למנהלי המשפחה בלבד.");
  const gid = uuidSchema.safeParse(id);
  if (!gid.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.from("garages").delete().eq("id", gid.data).eq("family_id", s.familyId).select("id");
  if (error) return fail(dbErrorMessage(error, "delete_garage"));
  if (!data?.length) return fail(NOT_FOUND);
  revalidate();
  return { ok: true };
}
