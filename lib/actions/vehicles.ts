"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage } from "@/lib/errors";
import { addMonths, formatNumber, KM, todayInIsrael } from "@/lib/format";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { dueFieldSchema, mileageSchema, uuidSchema, vehicleSchema, type VehicleInput } from "@/lib/validation";

const FORBIDDEN = "אין לך הרשאה לבצע את הפעולה.";
const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";
const NOT_FOUND = "הרכב לא נמצא. ייתכן שהוא נמחק.";

type DueField = "test_due" | "license_due";
const duePatch = (field: DueField, value: string | null) => (field === "test_due" ? { test_due: value } : { license_due: value });

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

/** Marks a test/license as renewed for 12 months and reports the previous date so the UI can offer undo. */
export async function renewDue(
  id: string,
  field: string,
): Promise<ActionResult<{ previous: string | null; next: string }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  const f = dueFieldSchema.safeParse(field);
  if (!vid.success || !f.success) return fail(BAD_REQUEST);

  const { data: current, error: readError } = await s.supabase.from("vehicles").select("test_due, license_due").eq("id", vid.data).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError, "renew_read"));
  if (!current) return fail(NOT_FOUND);

  const previous = current[f.data];
  const today = todayInIsrael();
  const base = previous && previous > today ? previous : today;
  const next = addMonths(base, 12);

  const { data, error } = await s.supabase.from("vehicles").update(duePatch(f.data, next)).eq("id", vid.data).select("id");
  if (error) return fail(dbErrorMessage(error, "renew"));
  if (!data?.length) return fail(FORBIDDEN);
  revalidateVehicle(vid.data);
  return { ok: true, previous, next };
}

/** Undo for renewDue. Only applies if the date is still the one the renewal produced. */
export async function restoreDue(
  id: string,
  field: string,
  restoreTo: string | null,
  expectedCurrent: string,
): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(id);
  const f = dueFieldSchema.safeParse(field);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!vid.success || !f.success || !iso.test(expectedCurrent) || (restoreTo !== null && !iso.test(restoreTo))) {
    return fail(BAD_REQUEST);
  }

  const { data, error } = await s.supabase
    .from("vehicles")
    .update(duePatch(f.data, restoreTo))
    .eq("id", vid.data)
    .eq(f.data, expectedCurrent)
    .select("id");
  if (error) return fail(dbErrorMessage(error, "restore_due"));
  if (!data?.length) return fail("התאריך השתנה מאז החידוש, ולכן אי אפשר לבטל אותו אוטומטית. אפשר לערוך אותו ידנית.");
  revalidateVehicle(vid.data);
  return { ok: true };
}
