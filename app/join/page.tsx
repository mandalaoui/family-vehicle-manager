import { redirect } from "next/navigation";
import Link from "next/link";
import { Car, Mail } from "lucide-react";
import { Section } from "@/components/ui/Layout";
import { ROLE_LABELS } from "@/lib/format";
import { dbErrorMessage } from "@/lib/errors";
import { getFamilyContext } from "@/lib/server/context";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "הזמנה · ניהול רכבי המשפחה" };

export default async function JoinPage() {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (ctx.membership) redirect("/home");

  const supabase = await createClient();
  const { data: invites } = await supabase.rpc("my_pending_invitations");
  const pending = invites ?? [];

  if (pending.length === 0) {
    const { error } = await supabase.rpc("ensure_personal_family");
    if (error) {
      return (
        <main className="mx-auto flex flex-1 max-w-md flex-col justify-center px-4 py-10 text-center">
          <h1 className="text-xl font-bold">לא הצלחנו לפתוח את רשימת הרכבים</h1>
          <p className="mt-2 text-sm text-muted">{dbErrorMessage(error, "ensure_personal_family")}</p>
        </main>
      );
    }
    redirect("/home");
  }

  return (
    <main className="mx-auto flex flex-1 max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white">
          <Car size={30} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">יש לכם הזמנה</h1>
        <p className="text-sm text-muted">אפשר להצטרף לפני שנפתחת רשימת רכבים משלכם.</p>
      </div>
      <Section icon={Mail} title={pending.length === 1 ? "הוזמנתם להצטרף" : "הוזמנתם להצטרף לכמה שיתופים"}>
        <ul className="flex flex-col gap-3">
          {pending.map((i) => (
            <li key={i.token} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                <strong>{i.family_name}</strong> · {ROLE_LABELS[i.role]}
              </span>
              <Link href={`/invite/${i.token}`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">
                להצטרפות
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <form action="/auth/signout" method="post" className="text-center">
        <button type="submit" className="min-h-[44px] text-sm font-semibold text-muted underline">
          התנתקות
        </button>
      </form>
    </main>
  );
}
