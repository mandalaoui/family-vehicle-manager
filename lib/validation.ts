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

export const vehicleSchema = z.object({
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
  test_due: dateOptional,
  license_due: dateOptional,
  insurance_due: dateOptional,
  next_service_km: intOptional(MAX_KM, "הערך גבוה מדי. בדקו את המספר"),
  notes: optionalText(2000, "ההערות"),
});
export type VehicleInput = z.input<typeof vehicleSchema>;

export const mileageSchema = z.object({
  mileage: intField("הזינו את הקילומטראז׳ מלוח השעונים", MAX_KM, "הקילומטראז׳ גבוה מדי. בדקו את המספר"),
});

export const serviceLogSchema = z.object({
  service_date: dateRequiredNotFuture("הזינו את תאריך הטיפול"),
  mileage: intField("הזינו את הקילומטראז׳ בעת הטיפול", MAX_KM, "הקילומטראז׳ גבוה מדי. בדקו את המספר"),
  garage: optionalText(80, "שם המוסך"),
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

export const dueFieldSchema = z.enum(["test_due", "license_due"]);
