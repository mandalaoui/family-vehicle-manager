"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage } from "@/lib/errors";
import { fail, isSession, requireSession, zodFail, type ActionResult } from "@/lib/server/action-utils";
import type { DeletedServiceLog } from "@/types/database";
import { serviceLogSchema, uuidSchema, type ServiceLogInput } from "@/lib/validation";

const BAD_REQUEST = "הבקשה לא תקינה. רעננו את הדף ונסו שוב.";

function revalidateVehicle(vehicleId: string) {
  revalidatePath("/");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
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
    p_garage_id: d.garage_id,
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
  const d = parsed.data;

  // One transaction: update the log and recompute next_service_km.
  const { data: vehicleId, error } = await s.supabase.rpc("update_service_log", {
    p_log_id: id.data,
    p_date: d.service_date,
    p_mileage: d.mileage,
    p_garage: d.garage,
    p_cost: d.cost,
    p_notes: d.notes,
    p_garage_id: d.garage_id,
  });
  if (error) return fail(dbErrorMessage(error, "update_service_log"));
  revalidateVehicle(vehicleId);
  return { ok: true };
}

/** Deletes a log (+ recompute, one transaction) and returns its content for the 9-second undo. */
export async function deleteServiceLog(logId: string): Promise<ActionResult<{ deleted: DeletedServiceLog }>> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const id = uuidSchema.safeParse(logId);
  if (!id.success) return fail(BAD_REQUEST);

  const { data, error } = await s.supabase.rpc("delete_service_log", { p_log_id: id.data });
  if (error) return fail(dbErrorMessage(error, "delete_service_log"));
  revalidateVehicle(data.vehicle_id);
  return { ok: true, deleted: data };
}

const restoreSchema = z.object({
  vehicle_id: z.string().uuid(),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mileage: z.number().int().min(0).max(2_000_000),
  garage: z.string().max(80).nullable(),
  garage_id: z.string().uuid().nullable().optional(),
  cost: z.number().min(0).max(9_999_999).nullable(),
  notes: z.string().max(2000).nullable(),
});

export async function restoreServiceLog(log: DeletedServiceLog): Promise<ActionResult> {
  const s = await requireSession();
  if (!isSession(s)) return fail(s.error);
  const parsed = restoreSchema.safeParse(log);
  if (!parsed.success) return fail(BAD_REQUEST);
  const d = parsed.data;

  // RLS rejects vehicles outside the caller's family.
  const { error } = await s.supabase.rpc("restore_service_log", {
    p_vehicle_id: d.vehicle_id,
    p_date: d.service_date,
    p_mileage: d.mileage,
    p_garage: d.garage,
    p_cost: d.cost,
    p_notes: d.notes,
    p_garage_id: d.garage_id,
  });
  if (error) return fail(dbErrorMessage(error, "restore_service_log"));
  revalidateVehicle(d.vehicle_id);
  return { ok: true };
}
