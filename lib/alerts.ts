import { addMonths, daysBetween, formatDate, formatDays, formatNumber, KM, todayInIsrael } from "./format";

// Pure, server-side friendly alert logic. `today` is an ISO date in Asia/Jerusalem.
export type AlertLevel = "overdue" | "urgent" | "soon" | "ok";
export type AlertKind = "license" | "insurance" | "service" | "mileage" | "battery" | "tires";

export const LEVEL_RANK: Record<AlertLevel, number> = { overdue: 0, urgent: 1, soon: 2, ok: 3 };
export const LEVEL_LABEL: Record<AlertLevel, string> = {
  overdue: "באיחור",
  urgent: "דחוף",
  soon: "בקרוב",
  ok: "תקין",
};

export const URGENT_DAYS = 7;
export const SOON_DAYS = 30;
export const SERVICE_URGENT_KM = 300;
export const SERVICE_SOON_KM = 1000;
export const STALE_MILEAGE_DAYS = 60;

export interface AlertVehicle {
  license_due: string | null;
  insurance_due: string | null;
  mileage: number;
  mileage_updated_at: string;
  next_service_km: number | null;
  service_interval_km: number;
  /** ISO timestamp; the 12-month fallback for an estimate counts from here. */
  created_at: string;
  battery_replaced_at?: string | null;
  battery_reminder_months?: number;
  tires_replaced_at?: string | null;
  tires_separate?: boolean;
  tire_fl_at?: string | null;
  tire_fr_at?: string | null;
  tire_rl_at?: string | null;
  tire_rr_at?: string | null;
  tires_replaced_km?: number | null;
  tires_reminder_months?: number;
  tires_reminder_km?: number;
}

export const DEFAULT_BATTERY_MONTHS = 36;
export const DEFAULT_TIRES_MONTHS = 48;
export const DEFAULT_TIRES_KM = 50_000;

export interface BatteryEstimate {
  dueDate: string;
  daysLeft: number;
  level: AlertLevel;
}

/** Battery reminder: N months after the replacement date (estimate). Null when no date is known. */
export function batteryEstimate(v: Pick<AlertVehicle, "battery_replaced_at" | "battery_reminder_months">, today: string): BatteryEstimate | null {
  if (!v.battery_replaced_at) return null;
  const dueDate = addMonths(v.battery_replaced_at, v.battery_reminder_months ?? DEFAULT_BATTERY_MONTHS);
  const daysLeft = daysBetween(today, dueDate);
  return { dueDate, daysLeft, level: dateLevel(daysLeft) };
}

export interface TiresEstimate {
  /** Oldest replacement date (with separate wheels: the oldest wheel). */
  oldestDate: string;
  dueDate: string;
  daysLeft: number;
  /** Null when the replacement mileage is unknown. */
  dueKm: number | null;
  kmLeft: number | null;
  level: AlertLevel;
}

export function tireDates(v: Pick<AlertVehicle, "tires_replaced_at" | "tires_separate" | "tire_fl_at" | "tire_fr_at" | "tire_rl_at" | "tire_rr_at">): string[] {
  const dates = v.tires_separate ? [v.tire_fl_at, v.tire_fr_at, v.tire_rl_at, v.tire_rr_at] : [v.tires_replaced_at];
  return dates.filter((d): d is string => Boolean(d));
}

export type WheelKey = "fr" | "fl" | "rr" | "rl";
export const WHEEL_LABELS: Record<WheelKey, string> = { fr: "קדמי ימני", fl: "קדמי שמאלי", rr: "אחורי ימני", rl: "אחורי שמאלי" };
export const WHEEL_ORDER: WheelKey[] = ["fl", "fr", "rl", "rr"];

export interface WheelStatus {
  /** Null when no date is known for this wheel. */
  level: AlertLevel | null;
  dueDate: string | null;
}

/**
 * Status of one wheel: its own date + the reminder months, combined with the vehicle-wide km reminder
 * (the worse of the two). Without a date the wheel is "not entered" (level null), never an alert.
 */
export function wheelStatus(
  date: string | null | undefined,
  v: { mileage: number; tires_replaced_km?: number | null; tires_reminder_months?: number; tires_reminder_km?: number },
  today: string,
): WheelStatus {
  if (!date) return { level: null, dueDate: null };
  const dueDate = addMonths(date, v.tires_reminder_months ?? DEFAULT_TIRES_MONTHS);
  const dateLvl = dateLevel(daysBetween(today, dueDate));
  const kmLeft = v.tires_replaced_km != null ? v.tires_replaced_km + (v.tires_reminder_km ?? DEFAULT_TIRES_KM) - v.mileage : null;
  const kmLvl = kmLeft != null ? serviceLevel(kmLeft) : "ok";
  return { level: LEVEL_RANK[kmLvl] <= LEVEL_RANK[dateLvl] ? kmLvl : dateLvl, dueDate };
}

/** Tires reminder: after N months or K km, whichever comes first (estimate). */
export function tiresEstimate(
  v: Pick<AlertVehicle, "mileage" | "tires_replaced_at" | "tires_separate" | "tire_fl_at" | "tire_fr_at" | "tire_rl_at" | "tire_rr_at" | "tires_replaced_km" | "tires_reminder_months" | "tires_reminder_km">,
  today: string,
): TiresEstimate | null {
  const dates = tireDates(v).sort();
  if (dates.length === 0) return null;
  const oldestDate = dates[0];
  const dueDate = addMonths(oldestDate, v.tires_reminder_months ?? DEFAULT_TIRES_MONTHS);
  const daysLeft = daysBetween(today, dueDate);
  const dueKm = v.tires_replaced_km != null ? v.tires_replaced_km + (v.tires_reminder_km ?? DEFAULT_TIRES_KM) : null;
  const kmLeft = dueKm != null ? dueKm - v.mileage : null;
  const dateLvl = dateLevel(daysLeft);
  const kmLvl = kmLeft != null ? serviceLevel(kmLeft) : "ok";
  return { oldestDate, dueDate, daysLeft, dueKm, kmLeft, level: LEVEL_RANK[kmLvl] <= LEVEL_RANK[dateLvl] ? kmLvl : dateLvl };
}

export interface VehicleAlert {
  kind: AlertKind;
  level: AlertLevel;
  title: string;
  detail: string;
  /** Lower = more pressing within the same level. */
  sort: number;
  /** True when computed without any real service log (shown as "הערכה"). */
  estimated?: boolean;
}

export const ESTIMATE_MONTHS = 12;

export interface ServiceEstimate {
  nextKm: number;
  nextDate: string;
  kmLeft: number;
  daysLeft: number;
  level: AlertLevel;
}

/**
 * Estimate used while there is no service history: the next multiple of the service interval above the
 * current mileage, or 12 months after the vehicle was added, whichever comes first. The date side counts
 * from the vehicle's creation (a "12 months from today" target would move every day and never fire).
 */
export function estimateService(v: Pick<AlertVehicle, "mileage" | "service_interval_km" | "created_at">, today: string): ServiceEstimate {
  const interval = Math.max(1, v.service_interval_km);
  const nextKm = (Math.floor(v.mileage / interval) + 1) * interval;
  const kmLeft = nextKm - v.mileage;
  const nextDate = addMonths(todayInIsrael(new Date(v.created_at)), ESTIMATE_MONTHS);
  const daysLeft = daysBetween(today, nextDate);
  const kmLvl = serviceLevel(kmLeft);
  const dateLvl = dateLevel(daysLeft);
  return { nextKm, nextDate, kmLeft, daysLeft, level: LEVEL_RANK[kmLvl] <= LEVEL_RANK[dateLvl] ? kmLvl : dateLvl };
}

export function dateLevel(days: number): AlertLevel {
  if (days < 0) return "overdue";
  if (days <= URGENT_DAYS) return "urgent";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

/** `kmLeft` = next_service_km - mileage. */
export function serviceLevel(kmLeft: number): AlertLevel {
  if (kmLeft <= 0) return "overdue";
  if (kmLeft <= SERVICE_URGENT_KM) return "urgent";
  if (kmLeft <= SERVICE_SOON_KM) return "soon";
  return "ok";
}

export function describeDays(days: number): string {
  if (days < 0) return `באיחור של ${formatDays(-days)}`;
  if (days === 0) return "פג היום";
  if (days === 1) return "פג מחר";
  return `בעוד ${days} ימים`;
}

// In Israel the annual license renewal requires passing the test, so test + license are ONE date.
const DATE_TITLES: Record<"license_due" | "insurance_due", { kind: AlertKind; title: string }> = {
  license_due: { kind: "license", title: "טסט וחידוש רישיון" },
  insurance_due: { kind: "insurance", title: "חידוש ביטוח" },
};

export function getVehicleAlerts(v: AlertVehicle, today: string): VehicleAlert[] {
  const alerts: VehicleAlert[] = [];

  for (const field of ["license_due", "insurance_due"] as const) {
    const due = v[field];
    if (!due) continue;
    const days = daysBetween(today, due);
    alerts.push({
      ...DATE_TITLES[field],
      level: dateLevel(days),
      detail: `${describeDays(days)} · תוקף עד ${formatDate(due)}`,
      sort: days,
    });
  }

  if (v.next_service_km != null) {
    const kmLeft = v.next_service_km - v.mileage;
    alerts.push({
      kind: "service",
      title: "טיפול תקופתי",
      level: serviceLevel(kmLeft),
      detail:
        kmLeft > 0
          ? `עוד ${formatNumber(kmLeft)} ${KM} (בקילומטראז׳ ${formatNumber(v.next_service_km)})`
          : `חריגה של ${formatNumber(-kmLeft)} ${KM}`,
      sort: kmLeft / 50, // roughly comparable with days
    });
  }

  if (v.next_service_km == null) {
    const est = estimateService(v, today);
    alerts.push({
      kind: "service",
      title: "טיפול תקופתי (הערכה)",
      level: est.level,
      detail: `הערכה: בקילומטראז׳ ${formatNumber(est.nextKm)} (עוד ${formatNumber(est.kmLeft)} ${KM}) או עד ${formatDate(est.nextDate)}, המוקדם מביניהם`,
      sort: Math.min(est.kmLeft / 50, est.daysLeft),
      estimated: true,
    });
  }

  const battery = batteryEstimate(v, today);
  if (battery) {
    alerts.push({
      kind: "battery",
      title: "בדיקת מצבר (הערכה)",
      level: battery.level,
      detail: `הערכה: ${describeDays(battery.daysLeft)} · סביב ${formatDate(battery.dueDate)}`,
      sort: battery.daysLeft,
      estimated: true,
    });
  }

  const tires = tiresEstimate(v, today);
  if (tires) {
    // "Whichever comes first" only makes sense when there are two limits (date and km).
    const hasKm = tires.kmLeft != null && tires.dueKm != null;
    const kmPart = hasKm ? ` או ${tires.kmLeft! > 0 ? `עוד ${formatNumber(tires.kmLeft!)} ${KM}` : `חריגה של ${formatNumber(-tires.kmLeft!)} ${KM}`}, המוקדם מביניהם` : "";
    alerts.push({
      kind: "tires",
      title: "בדיקת צמיגים (הערכה)",
      level: tires.level,
      detail: `הערכה: ${describeDays(tires.daysLeft)} · סביב ${formatDate(tires.dueDate)}${kmPart}`,
      sort: Math.min(tires.daysLeft, tires.kmLeft != null ? tires.kmLeft / 50 : Infinity),
      estimated: true,
    });
  }

  const age = daysBetween(v.mileage_updated_at, today);
  if (age > STALE_MILEAGE_DAYS) {
    alerts.push({
      kind: "mileage",
      title: "עדכנו קילומטראז'",
      level: "soon",
      detail: `הקריאה האחרונה לפני ${age} ימים`,
      sort: 1000,
    });
  }

  return alerts.sort(compareAlerts);
}

export function compareAlerts(a: Pick<VehicleAlert, "level" | "sort">, b: Pick<VehicleAlert, "level" | "sort">): number {
  return LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.sort - b.sort;
}

export function actionableAlerts(alerts: VehicleAlert[]): VehicleAlert[] {
  return alerts.filter((a) => a.level !== "ok");
}

export function isMileageStale(v: Pick<AlertVehicle, "mileage_updated_at">, today: string): boolean {
  return daysBetween(v.mileage_updated_at, today) > STALE_MILEAGE_DAYS;
}
