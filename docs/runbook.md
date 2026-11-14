# Runbook: תפעול והקמה

מסמך תפעול קצר. ההקמה הראשונית המלאה (Google OAuth, Supabase, Vercel) נמצאת ב־`README.md`.

## אזורים (חשוב לביצועים)

- **Supabase:** `eu-central-1` (פרנקפורט).
- **Vercel:** הפונקציות מוצמדות ל־`fra1` דרך `vercel.json` (`"regions": ["fra1"]`).
- שני האזורים צריכים להיות באותו אזור גיאוגרפי: כל בקשה לעמוד כוללת קריאה אחת ל־Auth (ב־proxy) ו־2–3 שאילתות, וכל אחת מהן הולכת על הרשת בין Vercel ל־Supabase.
- אם מקימים פרויקט Supabase באזור אחר, לעדכן את `regions` ב־`vercel.json` לאזור הקרוב אליו.

## משתני סביבה

| משתנה | חובה | הערות |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | כן | כתובת הפרויקט. מוטמע בבנייה, לכן **שינוי דורש פריסה מחדש** (Redeploy). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | כן | המפתח הציבורי בלבד. אסור `service_role`. |
| `DEBUG_TIMING` | לא | `1` רושם בלוג השרת כל קריאה ל־Supabase (שיטה, נתיב, זמן). לא מוציא מפתחות או נתונים. |
| `REMINDERS_ENABLED`, `CRON_SECRET`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` | לא | תשתית תזכורות באימייל. כבויה כברירת מחדל. ראו `docs/reminders.md`. |

## הקמת סביבה חדשה (למשל פרויקט Supabase חדש)

1. ליצור פרויקט Supabase באזור הרצוי.
2. להריץ ב־SQL Editor, לפי הסדר, את כל הקבצים ב־`supabase/migrations/` (כיום 6 קבצים, מ־`20261114120000` עד `20261118100000`).
3. ב־Authentication, להפעיל את Google ולהגדיר Site URL ו־Redirect URLs (`http://localhost:3000/**` ודומיין Vercel).
4. ב־Google Cloud לעדכן את ה־Authorized redirect URI לכתובת `https://<project-ref>.supabase.co/auth/v1/callback`.
5. לעדכן את שני משתני הסביבה ב־`.env.local` וב־Vercel, ולפרוס מחדש.
6. אם עוברים ממסד קיים: משתמשים צריכים להתחבר מחדש (cookie של הפרויקט הישן לא תקף).

## מדידת ביצועים

1. להגדיר `DEBUG_TIMING=1` ב־Vercel (Environment Variables) ולפרוס מחדש.
2. לגלוש בין הלוח, רשימת הרכבים, פרטי רכב והגדרות.
3. ב־Vercel → Logs לחפש `[sb]`. כל שורה היא קריאה אחת: `[sb] GET /rest/v1/vehicles 82ms`.
4. מדד מצופה לעמוד מחובר: קריאת Auth אחת (ב־proxy) ושאילתות מעטות, חלקן במקביל.
5. להסיר את המשתנה בסיום.

גודל JS לפי מסלול (בנייה מקומית):

```bash
npm run build
node scripts/route-js-size.mjs
```

## חידוש מפתחות והחלפת סביבה

- **מפתח Supabase ציבורי:** ב־Supabase → Project Settings → API. להחליף ב־`.env.local` וב־Vercel, ולפרוס מחדש.
- **Google OAuth secret:** ב־Google Cloud Console, ואז ב־Supabase → Authentication → Providers → Google.
- **`CRON_SECRET`** (כשמפעילים תזכורות): ליצור ערך חדש, לעדכן ב־Vercel, ולעדכן את ה־hash ב־`app_secrets`.
- אין להדפיס מפתחות בלוגים, בצ׳אט או ב־PR. הריפו ציבורי.

## בדיקות לפני מיזוג

```bash
npm run check
```

מריץ בסדר: typecheck, ‏lint, ‏Vitest (כולל בדיקות רכיבים ונגישות עם axe), בדיקות SQL ל־RLS על Postgres מקומי (PGlite), ו־build. אותו הדבר רץ ב־CI לכל PR.

הערה: בדיקת SQL אחת (`updated_at trigger`) מדולגת, כי PGlite מריץ את כל הסקריפט בטרנזקציה אחת ו־`now()` לא מתקדם. היא עוברת על Postgres אמיתי.

## תקלות נפוצות

| תסמין | סיבה אפשרית | מה לעשות |
|---|---|---|
| מכשיר אחד מציג נתונים אחרים | כתובת פריסה ישנה, `localhost` עם env ישן, או משתמש/משפחה אחרים | לוודא את הכתובת, לעצור שרת dev ולהפעילו מחדש, ולבדוק שהחשבון חבר באותה משפחה. ב־dev אפשר לפתוח `/api/diag` (מחזיר 404 בפרודקשן). |
| ״לא נמצא רכב״ או ״שירות לא זמין״ בשליפה | data.gov.il איטי, או חסימה לפי אזור | לנסות שוב. הזנה ידנית תמיד אפשרית. ״לא נמצא״ ותקלות לא נשמרים במטמון. |
| כל העמודים מחזירים 500 | חסרים משתני סביבה | לבדוק את שני משתני Supabase ב־Vercel ולפרוס מחדש. |
| שמירת טיפול או רכב נכשלת אחרי פריסה | המיגרציה האחרונה לא הורצה | להריץ את הקבצים החסרים ב־`supabase/migrations/`. |
| התחברות חוזרת ל־login | Redirect URL לא מוגדר ב־Supabase | להוסיף את הדומיין עם `/**`. |
