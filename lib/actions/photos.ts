"use server";

import { revalidateVehicle } from "@/lib/server/revalidate";
import { dbErrorMessage } from "@/lib/errors";
import { PHOTO_BUCKET, photoPath } from "@/lib/photo-path";
import { fail, isSession, requireSession, type ActionResult } from "@/lib/server/action-utils";
import { uuidSchema } from "@/lib/validation";

const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";

/** Called after the browser uploaded the file. The path is derived here, never taken from the client. */
export async function setVehiclePhoto(vehicleId: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(vehicleId);
  if (!vid.success) return fail(BAD_REQUEST);

  const path = photoPath(s.familyId, vid.data);
  const { data: files, error: listError } = await s.supabase.storage.from(PHOTO_BUCKET).list(s.familyId, { search: `${vid.data}.jpg`, limit: 1 });
  if (listError || !files?.some((f) => f.name === `${vid.data}.jpg`)) {
    return fail("ההעלאה לא הושלמה. נסו להעלות את התמונה שוב.");
  }

  const { data, error } = await s.supabase.from("vehicles").update({ photo_path: path }).eq("id", vid.data).eq("family_id", s.familyId).select("id");
  if (error) return fail(dbErrorMessage(error, "set_photo"));
  if (!data?.length) return fail("הרכב לא נמצא. ייתכן שהוא נמחק.");
  revalidateVehicle(vid.data);
  return { ok: true };
}

export async function removeVehiclePhoto(vehicleId: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(vehicleId);
  if (!vid.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.from("vehicles").update({ photo_path: null }).eq("id", vid.data).eq("family_id", s.familyId).select("id");
  if (error) return fail(dbErrorMessage(error, "remove_photo"));
  if (!data?.length) return fail("הרכב לא נמצא. ייתכן שהוא נמחק.");

  const removed = await s.supabase.storage.from(PHOTO_BUCKET).remove([photoPath(s.familyId, vid.data)]);
  if (removed.error) console.error("[remove_photo_object]", removed.error.message);
  revalidateVehicle(vid.data);
  return { ok: true };
}
