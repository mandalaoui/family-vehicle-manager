// Formatting + date helpers. Dates travel as ISO "YYYY-MM-DD" strings and are shown as dd/mm/yyyy.
// "Today" is always the calendar date in Asia/Jerusalem, never the server's or browser's zone.

export const KM = 'ק"מ';
export const SHEKEL = "₪";
export const TIME_ZONE = "Asia/Jerusalem";

const pad = (n: number) => String(n).padStart(2, "0");

export function todayInIsrael(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `fromIso` to `toIso` (positive when `toIso` is later). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(toUtc(iso) + n * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addMonths(iso: string, n: number): string {
  const [y, m, day] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** ISO -> dd/mm/yyyy ("—" when empty). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** dd/mm/yyyy (also accepts . or - separators) -> ISO, or null if it is not a real date. */
export function parseDMY(input: string | null | undefined): string | null {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec((input ?? "").trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Live input mask: keeps digits and inserts slashes -> dd/mm/yyyy. */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4);
  return out;
}

const numberFormat = new Intl.NumberFormat("he-IL");
export const formatNumber = (n: number) => numberFormat.format(n);

export const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** 7 digits -> XX-XXX-XX, 8 digits -> XXX-XX-XXX (stored as digits only). */
export function formatPlate(plate: string): string {
  if (plate.length === 8) return `${plate.slice(0, 3)}-${plate.slice(3, 5)}-${plate.slice(5)}`;
  if (plate.length === 7) return `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`;
  return plate;
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function formatDays(n: number): string {
  return n === 1 ? "יום" : `${n} ימים`;
}

export const FUEL_LABELS = {
  petrol: "בנזין",
  diesel: "דיזל",
  hybrid: "היברידי",
  plug_in: "פלאג־אין",
  electric: "חשמלי",
} as const;

export const COLORS = ["לבן", "שחור", "כסוף", "אפור", "כחול", "אדום", "ירוק", "צהוב", "אחר"] as const;

export const COLOR_HEX: Record<string, string> = {
  לבן: "#f8fafc",
  שחור: "#1f2937",
  כסוף: "#cbd5e1",
  אפור: "#94a3b8",
  כחול: "#3b82f6",
  אדום: "#ef4444",
  ירוק: "#22c55e",
  צהוב: "#facc15",
  אחר: "#a8a29e",
};

export const ROLE_LABELS = { admin: "מנהל", member: "חבר משפחה" } as const;
