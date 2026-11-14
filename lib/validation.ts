import { z } from "zod";
import { digitsOnly, parseDMY, todayInIsrael } from "./format";

// All client input arrives as strings (form fields). Schemas validate + convert, with Hebrew messages.
export const DATE_MSG = "הזינו תאריך בפורמט dd/mm/yyyy, למשל 31/12/2026";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} ארוך מדי (עד ${max} תווים)`)
    .transform((v) => (v === "" ? null : v));

const requiredText = (max: number, requiredMsg: string, label: string) =>
  z.string().trim().min(1, requiredMsg).max(max, `${label} ארוך מדי (עד ${max} תווים)`);

const dateOptional = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const iso = parseDMY(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: DATE_MSG });
      return z.NEVER;
    }
    return iso;
  });

const dateOptionalNotFuture = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const iso = parseDMY(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: DATE_MSG });
      return z.NEVER;
    }
    if (iso > todayInIsrael()) {
      ctx.addIssue({ code: "custom", message: "התאריך לא יכול להיות בעתיד" });
      return z.NEVER;
    }
    return iso;
  });

const dateRequiredNotFuture = (requiredMsg: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .transform((v, ctx) => {
      const iso = parseDMY(v);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: DATE_MSG });
        return z.NEVER;
      }
      if (iso > todayInIsrael()) {
        ctx.addIssue({ code: "custom", message: "התאריך לא יכול להיות בעתיד" });
        return z.NEVER;
      }
      return iso;
    });

const intField = (requiredMsg: string, max: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .regex(/^\d+$/, "הזינו מספר שלם, בלי אותיות או סימנים")
    .transform(Number)
    .pipe(z.number().max(max, maxMsg));

const intOptional = (max: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!/^\d+$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "הזינו מספר שלם, בלי אותיות או סימנים" });
        return z.NEVER;
      }
      const n = Number(v);
      if (n > max) {
        ctx.addIssue({ code: "custom", message: maxMsg });
        return z.NEVER;
      }
      return n;
    });

export const plateField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .pipe(z.string().regex(/^\d{7,8}$/, "מספר רכב תקין כולל 7 או 8 ספרות"));

const FUEL = ["petrol", "diesel", "hybrid", "plug_in", "electric"] as const;
const MAX_KM = 2_000_000;

export const DEFAULT_SERVICE_INTERVAL = 10000;

const vehicleBase = z.object({
  nickname: optionalText(60, "הכינוי"),
  plate: plateField,
  make: requiredText(40, "הזינו יצרן", "שם היצרן"),
  model: requiredText(40, "הזינו דגם", "שם הדגם"),
  year: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      const max = Number(todayInIsrael().slice(0, 4)) + 1;
      if (!/^\d{4}$/.test(v) || n < 1950 || n > max) {
        ctx.addIssue({ code: "custom", message: `הזינו שנת ייצור בין 1950 ל־${max}` });
        return z.NEVER;
      }
      return n;
    }),
  color: optionalText(30, "הצבע"),
  fuel_type: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!(FUEL as readonly string[]).includes(v)) {
        ctx.addIssue({ code: "custom", message: "בחרו סוג דלק מהרשימה" });
        return z.NEVER;
      }
      return v as (typeof FUEL)[number];
    }),
  mileage: intField("הזינו את הקילומטראז׳ הנוכחי", MAX_KM, "הקילומטראז׳ גבוה מדי. בדקו את המספר"),
  license_due: dateOptional,
  insurance_due: dateOptional,
  next_service_km: intOptional(MAX_KM, "הערך גבוה מדי. בדקו את המספר"),
  service_interval_km: intField("הזינו כל כמה ק״מ מבצעים טיפול", 100_000, "המרווח גבוה מדי. בדקו את המספר").pipe(
    z.number().min(1000, "מרווח הטיפול צריך להיות לפחות 1,000 ק״מ"),
  ),
  last_service_date: dateOptionalNotFuture,
  last_service_km: intOptional(MAX_KM, "הערך גבוה מדי. בדקו את המספר"),
  notes: optionalText(2000, "ההערות"),
  // Battery
  battery_replaced_at: dateOptionalNotFuture,
  battery_warranty_until: dateOptional,
  battery_notes: optionalText(1000, "הערות המצבר"),
  battery_reminder_months: intField("הזינו כל כמה חודשים לבדוק מצבר", 120, "המרווח גבוה מדי (עד 120 חודשים)").pipe(
    z.number().min(1, "המרווח צריך להיות לפחות חודש אחד"),
  ),
  // Tires
  tires_separate: z.boolean(),
  tires_replaced_at: dateOptionalNotFuture,
  tire_fl_at: dateOptionalNotFuture,
  tire_fr_at: dateOptionalNotFuture,
  tire_rl_at: dateOptionalNotFuture,
  tire_rr_at: dateOptionalNotFuture,
  tires_replaced_km: intOptional(MAX_KM, "הערך גבוה מדי. בדקו את המספר"),
  tires_reminder_months: intField("הזינו כל כמה חודשים לבדוק צמיגים", 120, "המרווח גבוה מדי (עד 120 חודשים)").pipe(
    z.number().min(1, "המרווח צריך להיות לפחות חודש אחד"),
  ),
  tires_reminder_km: intField("הזינו כל כמה ק״מ לבדוק צמיגים", 500_000, "המרווח גבוה מדי. בדקו את המספר").pipe(
    z.number().min(1000, "המרווח צריך להיות לפחות 1,000 ק״מ"),
  ),
});
function vehicleChecks(v: z.output<typeof vehicleBase>, ctx: z.RefinementCtx) {
  if ((v.last_service_date === null) !== (v.last_service_km === null)) {
    const path = v.last_service_date === null ? "last_service_date" : "last_service_km";
    ctx.addIssue({ code: "custom", path: [path], message: "מלאו גם תאריך וגם קילומטראז׳ של הטיפול האחרון, או השאירו את שניהם ריקים" });
  } else if (v.last_service_km !== null && v.last_service_km > v.mileage) {
    ctx.addIssue({ code: "custom", path: ["last_service_km"], message: "הטיפול האחרון לא יכול להיות בקילומטראז׳ גבוה מהקילומטראז׳ הנוכחי" });
  }
  if (v.tires_replaced_km !== null && v.tires_replaced_km > v.mileage) {
    ctx.addIssue({ code: "custom", path: ["tires_replaced_km"], message: "הקילומטראז׳ בהחלפת הצמיגים לא יכול להיות גבוה מהקילומטראז׳ הנוכחי" });
  }
}

function normalizeTires(v: z.output<typeof vehicleBase>) {
  return v.tires_separate
    ? { ...v, tires_replaced_at: null }
    : { ...v, tire_fl_at: null, tire_fr_at: null, tire_rl_at: null, tire_rr_at: null };
}
// Only one of the two tire modes is stored: a single date, or one date per wheel.
export const vehicleSchema = vehicleBase.superRefine(vehicleChecks).transform(normalizeTires);
export type VehicleInput = z.input<typeof vehicleBase>;

export const mileageSchema = z.object({
  mileage: intField("הזינו את הקילומטראז׳ מלוח השעונים", MAX_KM, "הקילומטראז׳ גבוה מדי. בדקו את המספר"),
});

export const serviceLogSchema = z.object({
  service_date: dateRequiredNotFuture("הזינו את תאריך הטיפול"),
  mileage: intField("הזינו את הקילומטראז׳ בעת הטיפול", MAX_KM, "הקילומטראז׳ גבוה מדי. בדקו את המספר"),
  garage: optionalText(80, "שם המוסך"),
  garage_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().uuid("המוסך שנבחר לא תקין").nullable()),
  cost: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const normalized = v.replace(",", ".");
      if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        ctx.addIssue({ code: "custom", message: "הזינו סכום בשקלים, למשל 450 או 450.50" });
        return z.NEVER;
      }
      const n = Number(normalized);
      if (n > 9_999_999) {
        ctx.addIssue({ code: "custom", message: "הסכום גבוה מדי. בדקו את המספר" });
        return z.NEVER;
      }
      return n;
    }),
  notes: optionalText(2000, "ההערות"),
});
export type ServiceLogInput = z.input<typeof serviceLogSchema>;

export const familyNameSchema = z
  .string()
  .trim()
  .min(1, "הזינו שם למשפחה, למשל ״משפחת כהן״")
  .max(60, "שם המשפחה ארוך מדי (עד 60 תווים)");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "הזינו כתובת אימייל")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "כתובת האימייל לא תקינה. בדקו שיש בה @ ושם דומיין");

export const roleSchema = z.enum(["admin", "member"], { error: "בחרו תפקיד מהרשימה" });
export const uuidSchema = z.string().uuid("המזהה לא תקין");
export const tokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{16,128}$/, "קישור ההזמנה לא תקין.");


export const garageSchema = z.object({
  name: requiredText(80, "הזינו שם מוסך", "שם המוסך"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!/^[0-9+()*\s-]{3,30}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "הזינו מספר טלפון תקין, למשל 03-1234567" });
        return z.NEVER;
      }
      return v;
    }),
  address: optionalText(200, "הכתובת"),
  notes: optionalText(1000, "ההערות"),
});
export type GarageInput = z.input<typeof garageSchema>;
