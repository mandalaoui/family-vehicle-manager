"use server";

import { revalidateVehicle } from "@/lib/server/revalidate";
import { dbErrorMessage } from "@/lib/errors";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { batterySchema, tiresSchema, uuidSchema, type BatteryInput, type TiresInput } from "@/lib/validation";

const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";
const NOT_FOUND = "הרכב לא נמצא. ייתכן שהוא נמחק.";

/** Quick edit of the battery card. Any family member (RLS: members update vehicles). */
export async function updateBattery(vehicleId: string, input: BatteryInput): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(vehicleId);
  if (!vid.success) return fail(BAD_REQUEST);
  const parsed = batterySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data, error } = await s.supabase.from("vehicles").update(parsed.data).eq("id", vid.data).eq("family_id", s.familyId).select("id");
  if (error) return fail(dbErrorMessage(error, "update_battery"));
  if (!data?.length) return fail(NOT_FOUND);
  revalidateVehicle(vid.data);
  return { ok: true };
}

/** Quick edit of the tires card: one date or one per wheel (the schema keeps only the active mode). */
export async function updateTires(vehicleId: string, input: TiresInput): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(vehicleId);
  if (!vid.success) return fail(BAD_REQUEST);
  const parsed = tiresSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data: current, error: readError } = await s.supabase.from("vehicles").select("mileage").eq("id", vid.data).eq("family_id", s.familyId).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "update_tires_read"));
  if (!current) return fail(NOT_FOUND);
  if (parsed.data.tires_replaced_km !== null && parsed.data.tires_replaced_km > current.mileage) {
    const message = "הקילומטראז׳ בהחלפת הצמיגים לא יכול להיות גבוה מהקילומטראז׳ הנוכחי";
    return fail(message, { tires_replaced_km: message });
  }

  const { data, error } = await s.supabase.from("vehicles").update(parsed.data).eq("id", vid.data).eq("family_id", s.familyId).select("id");
  if (error) return fail(dbErrorMessage(error, "update_tires"));
  if (!data?.length) return fail(NOT_FOUND);
  revalidateVehicle(vid.data);
  return { ok: true };
}
