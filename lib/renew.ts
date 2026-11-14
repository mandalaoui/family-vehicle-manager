import { daysBetween } from "./format";
import type { RenewalUndoEntry, Vehicle } from "@/types/database";

export const RENEW_UNDO_DAYS = 30;

/** The renewal undo that can still be applied: recent and the date is still the renewed one. */
export function activeUndo(
  v: Pick<Vehicle, "test_due" | "license_due" | "renewal_undo">,
  field: "test_due" | "license_due",
  today: string,
): RenewalUndoEntry | null {
  const entry = v.renewal_undo?.[field];
  if (!entry) return null;
  if (entry.next !== v[field]) return null;
  if (daysBetween(entry.at, today) > RENEW_UNDO_DAYS) return null;
  return entry;
}
