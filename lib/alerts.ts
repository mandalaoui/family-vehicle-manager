import { addMonths, daysBetween, formatDate, formatDays, formatNumber, KM, todayInIsrael } from "./format";

// Pure, server-side friendly alert logic. `today` is an ISO date in Asia/Jerusalem.
export type AlertLevel = "overdue" | "urgent" | "soon" | "ok";
export type AlertKind = "license" | "insurance" | "service" | "mileage";

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
