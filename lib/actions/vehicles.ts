"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, MINISTRY_NOT_FOUND, MINISTRY_UNAVAILABLE } from "@/lib/errors";
import { fetchMinistryVehicle } from "@/lib/server/ministry";
import { formatNumber, KM, todayInIsrael } from "@/lib/format";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { dueFieldSchema, mileageSchema, uuidSchema, vehicleSchema, type VehicleInput } from "@/lib/validation";

const FORBIDDEN = "אין לך הרשאה לבצע את הפעולה.";
const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";
const NOT_FOUND = "הרכב לא נמצא. ייתכן שהוא נמחק.";

function revalidateVehicle(id?: string) {
  revalidatePath("/");
  revalidatePath("/vehicles");
  if (id) revalidatePath(`/vehicles/${id}`);
}

export async function createVehicle(input: VehicleInput): Promise<ActionResult<{ id: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail("הוספת רכב פתוחה למנהלי המשפחה בלבד.");

  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  // family_id comes from the database membership, never from the client.
  const { data, error } = await s.supabase
    .from("vehicles")
    .insert({ ...parsed.data, family_id: s.familyId, mileage_updated_at: todayInIsrael() })
    .select("id")
    .single();
  if (error) {
    const message = dbErrorMessage(error, "create_vehicle");
    return fail(message, error.code === "23505" ? { plate: message } : undefined);
  }
  revalidateVehicle(data.id);
  return { ok: true, id: data.id };
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data: current, error: readError } = await s.supabase.from("vehicles").select("mileage").eq("id", vid.data).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "update_vehicle_read"));
  if (!current) return fail(NOT_FOUND);

  const patch = {
    ...parsed.data,
    ...(parsed.data.mileage !== current.mileage ? { mileage_updated_at: todayInIsrael() } : {}),
  };
  const { data, error } = await s.supabase.from("vehicles").update(patch).eq("id", vid.data).select("id");
  if (error) {
    const message = dbErrorMessage(error, "update_vehicle");
    return fail(message, error.code === "23505" ? { plate: message } : undefined);
  }
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle(vid.data);
  return { ok: true };
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail("מחיקת רכב פתוחה למנהלי המשפחה בלבד.");
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.from("vehicles").delete().eq("id", vid.data).select("id");
  if (error) return fail(dbErrorMessage(error, "delete_vehicle"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle();
  return { ok: true };
}

export async function updateMileage(id: string, mileage: string): Promise<ActionResult<{ mileage: number }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const parsed = mileageSchema.safeParse({ mileage });
  if (!parsed.success) return zodFail(parsed.error);

  const { data: current, error: readError } = await s.supabase.from("vehicles").select("mileage").eq("id", vid.data).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "update_mileage_read"));
  if (!current) return fail(NOT_FOUND);
  if (parsed.data.mileage < current.mileage) {
    const msg = `הערך נמוך מהקריאה האחרונה (${formatNumber(current.mileage)} ${KM}). בדקו את המספר. לתיקון טעות אפשר לערוך את פרטי הרכב.`;
    return fail(msg, { mileage: msg });
  }

  const { data, error } = await s.supabase
    .from("vehicles")
    .update({ mileage: parsed.data.mileage, mileage_updated_at: todayInIsrael() })
    .eq("id", vid.data)
    .select("id");
  if (error) return fail(dbErrorMessage(error, "update_mileage"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle(vid.data);
  return { ok: true, mileage: parsed.data.mileage };
}

/** Marks a test/license as renewed for 12 months (one DB transaction); the DB stores the undo info. */
export async function renewDue(
  id: string,
  field: string,
): Promise<ActionResult<{ previous: string | null; next: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  const f = dueFieldSchema.safeParse(field);
  if (!vid.success || !f.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.rpc("renew_due", { p_vehicle_id: vid.data, p_field: f.data });
  if (error) return fail(dbErrorMessage(error, "renew_due"));
  revalidateVehicle(vid.data);
  return { ok: true, previous: data.previous, next: data.next };
}

/** Undo for renewDue (30 days, only while the date is still the renewed one; enforced in the DB). */
export async function undoRenewDue(id: string, field: string): Promise<ActionResult<{ restoredTo: string | null }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  const f = dueFieldSchema.safeParse(field);
  if (!vid.success || !f.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.rpc("undo_renew_due", { p_vehicle_id: vid.data, p_field: f.data });
  if (error) return fail(dbErrorMessage(error, "undo_renew_due"));
  revalidateVehicle(vid.data);
  return { ok: true, restoredTo: data };
}

/** Updates test + license dates from the Ministry of Transport (tokef_dt), bypassing the 1-day cache. */
export async function refreshFromMinistry(id: string): Promise<ActionResult<{ validUntil: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const { data: vehicle, error: readError } = await s.supabase.from("vehicles").select("plate").eq("id", vid.data).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "refresh_read"));
  if (!vehicle) return fail(NOT_FOUND);

  const result = await fetchMinistryVehicle(vehicle.plate, { fresh: true });
  if (result.status === "not_found") return fail(MINISTRY_NOT_FOUND);
  if (result.status === "unavailable") return fail(MINISTRY_UNAVAILABLE);
  const validUntil = result.vehicle.valid_until;
  if (!validUntil) return fail("משרד התחבורה לא החזיר תאריך תוקף לרכב הזה.");

  const { data, error } = await s.supabase
    .from("vehicles")
    .update({ test_due: validUntil, license_due: validUntil })
    .eq("id", vid.data)
    .select("id");
  if (error) return fail(dbErrorMessage(error, "refresh_update"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle(vid.data);
  return { ok: true, validUntil };
}
