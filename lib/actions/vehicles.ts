"use server";

import { revalidateVehicle } from "@/lib/server/revalidate";
import { dbErrorMessage, MINISTRY_NOT_FOUND, MINISTRY_UNAVAILABLE } from "@/lib/errors";
import { fetchMinistryVehicle } from "@/lib/server/ministry";
import { rateLimited } from "@/lib/server/rate-limit";
import { PHOTO_BUCKET, photoPath } from "@/lib/photo-path";
import { formatNumber, KM, todayInIsrael } from "@/lib/format";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { mileageSchema, uuidSchema, vehicleSchema, type VehicleInput } from "@/lib/validation";

const FORBIDDEN = "אין לך הרשאה לבצע את הפעולה.";
const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";
const NOT_FOUND = "הרכב לא נמצא. ייתכן שהוא נמחק.";

export async function createVehicle(input: VehicleInput): Promise<ActionResult<{ id: string; warning?: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail("הוספת רכב פתוחה למנהלים בלבד.");

  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { last_service_date, last_service_km, ...fields } = parsed.data;

  // family_id comes from the database membership, never from the client.
  const { data, error } = await s.supabase
    .from("vehicles")
    .insert({ ...fields, family_id: s.familyId, mileage_updated_at: todayInIsrael() })
    .select("id")
    .single();
  if (error) {
    const message = dbErrorMessage(error, "create_vehicle");
    return fail(message, error.code === "23505" ? { plate: message } : undefined);
  }

  // Optional "last service": create the initial log through the existing RPC so next service is computed.
  let warning: string | undefined;
  if (last_service_date && last_service_km !== null) {
    const rpc = await s.supabase.rpc("complete_service", {
      p_vehicle_id: data.id,
      p_date: last_service_date,
      p_mileage: last_service_km,
      p_garage: null,
      p_cost: null,
      p_notes: null,
    });
    if (rpc.error) warning = `הרכב נשמר, אבל לא הצלחנו לתעד את הטיפול האחרון: ${dbErrorMessage(rpc.error, "initial_service")}`;
  }
  revalidateVehicle(data.id);
  return { ok: true, id: data.id, warning };
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<ActionResult<{ warning?: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data: current, error: readError } = await s.supabase.from("vehicles").select("mileage, service_interval_km").eq("id", vid.data).eq("family_id", s.familyId).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "update_vehicle_read"));
  if (!current) return fail(NOT_FOUND);

  const { last_service_date, last_service_km, ...fields } = parsed.data;
  const patch = {
    ...fields,
    ...(fields.mileage !== current.mileage ? { mileage_updated_at: todayInIsrael() } : {}),
  };
  const { data, error } = await s.supabase.from("vehicles").update(patch).eq("id", vid.data).eq("family_id", s.familyId).select("id");
  if (error) {
    const message = dbErrorMessage(error, "update_vehicle");
    return fail(message, error.code === "23505" ? { plate: message } : undefined);
  }
  if (!data?.length) return fail(FORBIDDEN);

  // Initial "last service": only when the vehicle has no service history yet (avoids duplicates).
  let warning: string | undefined;
  if (last_service_date && last_service_km !== null) {
    const { count } = await s.supabase.from("service_logs").select("id", { count: "exact", head: true }).eq("vehicle_id", vid.data);
    if (!count) {
      const rpc = await s.supabase.rpc("complete_service", {
        p_vehicle_id: vid.data,
        p_date: last_service_date,
        p_mileage: last_service_km,
        p_garage: null,
        p_cost: null,
        p_notes: null,
      });
      if (rpc.error) warning = `הפרטים נשמרו, אבל לא הצלחנו לתעד את הטיפול האחרון: ${dbErrorMessage(rpc.error, "initial_service")}`;
    }
  } else if (fields.service_interval_km !== current.service_interval_km) {
    // The interval changed: recompute next_service_km from the latest log (no-op without logs).
    await s.supabase.rpc("recompute_next_service", { p_vehicle_id: vid.data });
  }
  revalidateVehicle(vid.data);
  return { ok: true, warning };
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  if (s.role !== "admin") return fail("מחיקת רכב פתוחה למנהלים בלבד.");
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  // Remove the photo first: the storage policy needs the vehicle row to exist, so after the delete
  // the object could never be removed again through the API.
  const { data: existing } = await s.supabase.from("vehicles").select("photo_path").eq("id", vid.data).eq("family_id", s.familyId).maybeSingle();
  if (existing?.photo_path) {
    const removed = await s.supabase.storage.from(PHOTO_BUCKET).remove([photoPath(s.familyId, vid.data)]);
    if (removed.error) console.error("[delete_vehicle_photo]", removed.error.message);
  }

  const { data, error } = await s.supabase.from("vehicles").delete().eq("id", vid.data).eq("family_id", s.familyId).select("id");
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

  const { data: current, error: readError } = await s.supabase.from("vehicles").select("mileage").eq("id", vid.data).eq("family_id", s.familyId).maybeSingle();
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
    .eq("family_id", s.familyId)
    .select("id");
  if (error) return fail(dbErrorMessage(error, "update_mileage"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle(vid.data);
  return { ok: true, mileage: parsed.data.mileage };
}

/** Marks the test + license as renewed for 12 months (one DB transaction); the DB stores the undo info. */
export async function renewDue(id: string): Promise<ActionResult<{ previous: string | null; next: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.rpc("renew_due", { p_vehicle_id: vid.data, p_field: "license_due" });
  if (error) return fail(dbErrorMessage(error, "renew_due"));
  revalidateVehicle(vid.data);
  return { ok: true, previous: data.previous, next: data.next };
}

/** Undo for renewDue (30 days, only while the date is still the renewed one; enforced in the DB). */
export async function undoRenewDue(id: string): Promise<ActionResult<{ restoredTo: string | null }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.rpc("undo_renew_due", { p_vehicle_id: vid.data, p_field: "license_due" });
  if (error) return fail(dbErrorMessage(error, "undo_renew_due"));
  revalidateVehicle(vid.data);
  return { ok: true, restoredTo: data };
}

/** Updates the test + license date from the Ministry of Transport (tokef_dt), bypassing the 1-day cache. */
export async function refreshFromMinistry(id: string): Promise<ActionResult<{ validUntil: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  if (!vid.success) return fail(BAD_REQUEST);

  if (rateLimited(`refresh:${s.userId}`, 10, 60_000)) return fail("יותר מדי רענונות בזמן קצר. נסו שוב בעוד דקה.");

  const { data: vehicle, error: readError } = await s.supabase.from("vehicles").select("plate").eq("id", vid.data).eq("family_id", s.familyId).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "refresh_read"));
  if (!vehicle) return fail(NOT_FOUND);

  const result = await fetchMinistryVehicle(vehicle.plate, { fresh: true });
  if (result.status === "not_found") return fail(MINISTRY_NOT_FOUND);
  if (result.status === "unavailable") return fail(MINISTRY_UNAVAILABLE);
  const validUntil = result.vehicle.valid_until;
  if (!validUntil) return fail("משרד התחבורה לא החזיר תאריך תוקף לרכב הזה.");

  const { data, error } = await s.supabase
    .from("vehicles")
    .update({ license_due: validUntil })
    .eq("id", vid.data)
    .eq("family_id", s.familyId)
    .select("id");
  if (error) return fail(dbErrorMessage(error, "refresh_update"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle(vid.data);
  return { ok: true, validUntil };
}
