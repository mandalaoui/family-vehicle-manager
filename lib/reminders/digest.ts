import { getVehicleAlerts, LEVEL_RANK, type AlertLevel, type AlertVehicle, type VehicleAlert } from "@/lib/alerts";
import { daysBetween } from "@/lib/format";
import { vehicleDisplayName } from "./name";

// Pure reminder logic (no I/O): which alerts deserve an email, and how to group them into one digest.
// Nothing here sends anything; see docs/reminders.md for the (disabled) delivery pipeline.

export interface ReminderVehicle extends AlertVehicle {
  id: string;
  plate: string;
  nickname: string | null;
  make: string;
  model: string;
}

export interface ReminderItem {
  /** Stable key for dedupe: the same vehicle + kind + level is only mailed once. */
  key: string;
  vehicleId: string;
  vehicleName: string;
  plate: string;
  alert: VehicleAlert;
}

export interface DigestOptions {
  /** Levels that trigger an email. Default: everything except "ok". */
  levels?: AlertLevel[];
  /** Estimated alerts (battery, tires, service without history) can be left out of emails. */
  includeEstimates?: boolean;
  /** The "update your odometer" nudge is a UI hint; off by default for email. */
  includeMileageNudge?: boolean;
}

export const reminderKey = (vehicleId: string, alert: Pick<VehicleAlert, "kind" | "level">) => `${vehicleId}:${alert.kind}:${alert.level}`;

/** All alerts that should be considered for an email, most urgent first. */
export function collectReminders(vehicles: ReminderVehicle[], today: string, opts: DigestOptions = {}): ReminderItem[] {
  const levels = new Set<AlertLevel>(opts.levels ?? ["overdue", "urgent", "soon"]);
  const items: ReminderItem[] = [];
  for (const v of vehicles) {
    for (const alert of getVehicleAlerts(v, today)) {
      if (!levels.has(alert.level)) continue;
      if (alert.estimated && opts.includeEstimates === false) continue;
      if (alert.kind === "mileage" && !opts.includeMileageNudge) continue;
      items.push({ key: reminderKey(v.id, alert), vehicleId: v.id, vehicleName: vehicleDisplayName(v), plate: v.plate, alert });
    }
  }
  return items.sort((a, b) => LEVEL_RANK[a.alert.level] - LEVEL_RANK[b.alert.level] || a.alert.sort - b.alert.sort);
}

/**
 * Drops items that were already mailed at the same level. When an alert gets worse (soon -> urgent ->
 * overdue) its key changes, so it is mailed again; "overdue" repeats every `repeatOverdueDays` days.
 */
export function selectNewReminders(
  items: ReminderItem[],
  sent: ReadonlyMap<string, string>,
  today: string,
  repeatOverdueDays = 7,
): ReminderItem[] {
  return items.filter((item) => {
    const last = sent.get(item.key);
    if (!last) return true;
    return item.alert.level === "overdue" && daysBetween(last, today) >= repeatOverdueDays;
  });
}
