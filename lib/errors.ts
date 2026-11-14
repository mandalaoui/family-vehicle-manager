// Maps database errors to clear Hebrew sentences. The real error is logged server-side only.
export const GENERIC_ERROR = "משהו השתבש בצד השרת. נסו שוב בעוד רגע.";

const MESSAGES: Record<string, string> = {
  last_admin: "לא ניתן להסיר או להוריד בדרגה את המנהל האחרון. מנו קודם מנהל נוסף ואז נסו שוב.",
  forbidden: "אין לך הרשאה לבצע את הפעולה.",
  not_authenticated: "ההתחברות פגה. התחברו שוב.",
  already_member: "כתובת האימייל הזאת כבר חברה במשפחה.",
  invite_exists: "כבר קיימת הזמנה פעילה לכתובת הזאת. אפשר לבטל אותה וליצור חדשה.",
  invitation_invalid: "קישור ההזמנה לא תקין.",
  invitation_revoked: "ההזמנה בוטלה על ידי מנהל המשפחה.",
  invitation_used: "ההזמנה כבר נוצלה.",
  invitation_expired: "תוקף ההזמנה פג. בקשו ממנהל המשפחה הזמנה חדשה.",
  email_mismatch: "ההזמנה נשלחה לכתובת Google אחרת. התחברו עם החשבון שאליו נשלחה ההזמנה.",
  invalid_email: "כתובת האימייל לא תקינה. בדקו שיש בה @ ושם דומיין.",
  invalid_name: "שם המשפחה חייב להכיל בין 1 ל־60 תווים.",
  invalid_field: "השדה שנבחר לא תקין.",
  undo_unavailable: "אין חידוש לביטול.",
  undo_expired: "עברו יותר מ־30 יום מהחידוש, ולכן אי אפשר לבטל אותו.",
  undo_stale: "התאריך שונה מאז החידוש, ולכן אי אפשר לבטל אותו אוטומטית. אפשר לערוך אותו ידנית.",
  already_in_family: "החשבון הזה כבר חבר במשפחה. כדי להצטרף למשפחה אחרת, עזבו קודם את המשפחה הנוכחית בהגדרות.",
  invalid_role: "התפקיד שנבחר לא תקין.",
};

export interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

export function dbErrorMessage(error: DbErrorLike | null | undefined, context = "db"): string {
  const message = (error?.message ?? "").trim();
  if (message in MESSAGES) return MESSAGES[message];

  if (error?.code === "23505" && /vehicles_family_id_plate_key/.test(`${message} ${error.details ?? ""}`)) {
    return "רכב עם המספר הזה כבר קיים במשפחה.";
  }
  if (error?.code === "42501") return MESSAGES.forbidden; // insufficient_privilege / RLS

  console.error(`[${context}]`, { code: error?.code, message });
  return GENERIC_ERROR;
}

export const MINISTRY_NOT_FOUND = "לא נמצא רכב עם מספר זה";
export const MINISTRY_UNAVAILABLE = "שירות משרד התחבורה לא זמין או איטי כרגע. אפשר להזין את הפרטים ידנית.";
