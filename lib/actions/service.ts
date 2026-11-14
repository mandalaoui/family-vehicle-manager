"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage } from "@/lib/errors";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import { serviceLogSchema, uuidSchema, type ServiceLogInput } from "@/lib/validation";

const FORBIDDEN = "אין לך הרשאה לבצע את הפעולה.";
const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";

function revalidateVehicle(vehicleId: string) {
  revalidatePath("/");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export interface DeletedServiceLog {
  vehicle_id: string;
  service_date: string;
  mileage: number;
  garage: string | null;
  cost: number | null;
  notes: string | null;
}

/** "Service done": one transaction in the database (complete_service RPC, SECURITY INVOKER). */
export async function completeService(
  vehicleId: string,
  input: ServiceLogInput,
): Promise<ActionResult<{ nextServiceKm: number | null }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const vid = uuidSchema.safeParse(vehicleId);
  if (!vid.success) return fail(BAD_REQUEST);

  const parsed = serviceLogSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const { error } = await s.supabase.rpc("complete_service", {
    p_vehicle_id: vid.data,
    p_date: d.service_date,
    p_mileage: d.mileage,
    p_garage: d.garage,
    p_cost: d.cost,
    p_notes: d.notes,
  });
  if (error) return fail(dbErrorMessage(error, "complete_service"));

  const { data: vehicle } = await s.supabase.from("vehicles").select("next_service_km").eq("id", vid.data).maybeSingle();
  revalidateVehicle(vid.data);
  return { ok: true, nextServiceKm: vehicle?.next_service_km ?? null };
}

export async function updateServiceLog(logId: string, input: ServiceLogInput): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const id = uuidSchema.safeParse(logId);
  if (!id.success) return fail(BAD_REQUEST);

  const parsed = serviceLogSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { data, error } = await s.supabase
    .from("service_logs")
    .update({
      service_date: parsed.data.service_date,
      mileage: parsed.data.mileage,
      garage: parsed.data.garage,
      cost: parsed.data.cost,
      notes: parsed.data.notes,
    })
    .eq("id", id.data)
    .select("vehicle_id");
  if (error) return fail(dbErrorMessage(error, "update_service_log"));
  const vehicleId = data?.[0]?.vehicle_id;
  if (!vehicleId) return fail(FORBIDDEN);

  const rec = await s.supabase.rpc("recompute_next_service", { p_vehicle_id: vehicleId });
  if (rec.error) return fail(dbErrorMessage(rec.error, "recompute_next_service"));
  revalidateVehicle(vehicleId);
  return { ok: true };
}

/** Deletes a log and returns its content so the UI can offer a 9-second undo. */
export async function deleteServiceLog(logId: string): Promise<ActionResult<{ deleted: DeletedServiceLog }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const id = uuidSchema.safeParse(logId);
  if (!id.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase
    .from("service_logs")
    .delete()
    .eq("id", id.data)
    .select("vehicle_id, service_date, mileage, garage, cost, notes");
  if (error) return fail(dbErrorMessage(error, "delete_service_log"));
  const deleted = data?.[0];
  if (!deleted) return fail(FORBIDDEN);

  const rec = await s.supabase.rpc("recompute_next_service", { p_vehicle_id: deleted.vehicle_id });
  if (rec.error) return fail(dbErrorMessage(rec.error, "recompute_next_service"));
  revalidateVehicle(deleted.vehicle_id);
  return { ok: true, deleted };
}

const restoreSchema = z.object({
  vehicle_id: z.string().uuid(),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mileage: z.number().int().min(0).max(2_000_000),
  garage: z.string().max(80).nullable(),
  cost: z.number().min(0).max(9_999_999).nullable(),
  notes: z.string().max(2000).nullable(),
});

export async function restoreServiceLog(log: DeletedServiceLog): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const parsed = restoreSchema.safeParse(log);
  if (!parsed.success) return fail(BAD_REQUEST);

  // RLS (can_access_vehicle) rejects vehicles outside the caller's family.
  const { error } = await s.supabase.from("service_logs").insert({ ...parsed.data, created_by: s.userId });
  if (error) return fail(dbErrorMessage(error, "restore_service_log"));

  const rec = await s.supabase.rpc("recompute_next_service", { p_vehicle_id: parsed.data.vehicle_id });
  if (rec.error) return fail(dbErrorMessage(rec.error, "recompute_next_service"));
  revalidateVehicle(parsed.data.vehicle_id);
  return { ok: true };
}
