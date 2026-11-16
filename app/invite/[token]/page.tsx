import { CircleCheck, Info, Mail, TriangleAlert } from "lucide-react";
import { AcceptInvitationButton } from "@/components/AcceptInvitationButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Layout";
import { ROLE_LABELS } from "@/lib/format";
import Link from "next/link";
import { getFamilyContext } from "@/lib/server/context";
import { tokenSchema } from "@/lib/validation";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "הזמנת משתתף · ניהול רכבי המשפחה" };

const STATUS_MESSAGES = {
  expired: "תוקף ההזמנה פג. בקשו ממנהל הזמנה חדשה.",
  revoked: "ההזמנה בוטלה על ידי מנהל.",
  accepted: "ההזמנה כבר נוצלה.",
  invalid: "קישור ההזמנה לא תקין.",
} as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex flex-1 max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-silver-300 bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = tokenSchema.safeParse(token);

  let preview: { family_name: string; role: "admin" | "member"; status: string; email_matches: boolean | null } | undefined;
  if (parsed.success) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invitation_preview", { p_token: parsed.data });
    preview = data?.[0];
  }

  if (!parsed.success || !preview) {
    return (
      <Shell>
        <h1 className="mb-3 text-xl font-bold">ההזמנה לא נמצאה</h1>
        <Notice tone="error" icon={TriangleAlert} role="alert">
          {STATUS_MESSAGES.invalid} בקשו ממנהל לשלוח קישור חדש.
        </Notice>
      </Shell>
    );
  }

  if (preview.status !== "pending") {
    const message = STATUS_MESSAGES[preview.status as "expired" | "revoked" | "accepted"] ?? STATUS_MESSAGES.invalid;
    return (
      <Shell>
        <h1 className="mb-3 text-xl font-bold">ההזמנה אינה פעילה</h1>
        <Notice tone="warn" icon={Info} role="alert">
          {message}
        </Notice>
      </Shell>
    );
  }

  const ctx = await getFamilyContext();
  const user = ctx?.user ?? null;
  const next = `/invite/${parsed.data}`;
  let vehicleCount = 0;
  if (ctx?.membership) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("family_id", ctx.membership.familyId);
    vehicleCount = count ?? 0;
  }
  const emptySolo = ctx?.membership != null && ctx.membership.memberCount === 1 && vehicleCount === 0;

  return (
    <Shell>
      <div className="mb-5 flex flex-col items-center gap-3 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand">
          <Mail size={28} aria-hidden />
        </span>
        <h1 className="text-xl font-bold">הוזמנתם להצטרף ל{preview.family_name}</h1>
        <p className="text-sm text-muted">
          התפקיד שלכם: <strong>{ROLE_LABELS[preview.role]}</strong>
        </p>
      </div>

      {!user ? (
        <div className="flex flex-col gap-3">
          <Notice icon={Info}>התחברו עם חשבון ה־Google שאליו נשלחה ההזמנה כדי להצטרף.</Notice>
          <GoogleSignInButton next={next} />
        </div>
      ) : preview.email_matches === false ? (
        <div className="flex flex-col gap-3">
          <Notice tone="error" icon={TriangleAlert} role="alert">
            ההזמנה נשלחה לכתובת Google אחרת. התחברו עם החשבון שאליו נשלחה ההזמנה.
          </Notice>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="neutral" className="w-full">
              התנתקות והתחברות עם חשבון אחר
            </Button>
          </form>
        </div>
      ) : ctx?.membership && !emptySolo ? (
        <div className="flex flex-col gap-3">
          <Notice tone="warn" icon={Info} role="alert">
            {vehicleCount > 0
              ? "כבר יש רכבים בשיתוף הזה, אז ההזמנה לא מתקבלת. שום רכב לא נמחק."
              : "בשיתוף הזה יש עוד משתתפים, אז ההזמנה לא מתקבלת. שום דבר לא נמחק."}
          </Notice>
          <Link href="/home" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-silver-300 bg-white px-4 font-semibold">
            חזרה לרכבים
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {emptySolo ? (
            <Notice icon={Info}>קבלת ההזמנה מוחקת את הרשימה הריקה של החשבון הזה. אין בה רכבים.</Notice>
          ) : (
            <Notice tone="success" icon={CircleCheck}>
              מחוברים עם החשבון הנכון. אפשר להצטרף.
            </Notice>
          )}
          <AcceptInvitationButton token={parsed.data} />
        </div>
      )}
    </Shell>
  );
}
