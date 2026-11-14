import { daysBetween, formatDate, formatDays, formatNumber, KM } from "./format";

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
}

export interface VehicleAlert {
  kind: AlertKind;
  level: AlertLevel;
  title: string;
  detail: string;
  /** Lower = more pressing within the same level. */
  sort: number;
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
