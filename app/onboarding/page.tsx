import { redirect } from "next/navigation";
import Link from "next/link";
import { Car, Mail } from "lucide-react";
import { OnboardingForms } from "@/components/OnboardingForms";
import { Section } from "@/components/ui/Layout";
import { ROLE_LABELS } from "@/lib/format";
import { getFamilyContext } from "@/lib/server/context";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "ברוכים הבאים · ניהול רכבי המשפחה" };

export default async function OnboardingPage() {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (ctx.membership) redirect("/home");

  // Invitations addressed to this Google account: a new user who skipped the link still finds them here.
  const supabase = await createClient();
  const { data: invites } = await supabase.rpc("my_pending_invitations");
  const pendingInvites = invites ?? [];

  const name = (ctx.user.user_metadata?.full_name ?? ctx.user.user_metadata?.name ?? "") as string;

  return (
    <main className="mx-auto flex flex-1 max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white">
          <Car size={30} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">{name ? `ברוכים הבאים, ${name.split(" ")[0]}` : "ברוכים הבאים"}</h1>
        <p className="text-sm text-muted">כדי להתחיל, פתחו משפחה חדשה או הצטרפו למשפחה שכבר קיימת.</p>
      </div>
      {pendingInvites.length > 0 ? (
        <Section icon={Mail} title={pendingInvites.length === 1 ? "הוזמנתם להצטרף למשפחה" : "הוזמנתם להצטרף למשפחות"}>
          <ul className="flex flex-col gap-3">
            {pendingInvites.map((i) => (
              <li key={i.token} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  <strong>{i.family_name}</strong> · {ROLE_LABELS[i.role]}
                </span>
                <Link href={`/invite/${i.token}`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">
                  להצטרפות למשפחה
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">רוצים משפחה נפרדת משלכם במקום? אפשר לפתוח אחת למטה.</p>
        </Section>
      ) : null}
      <OnboardingForms />
      <form action="/auth/signout" method="post" className="text-center">
        <button type="submit" className="min-h-[44px] text-sm font-semibold text-muted underline">
          התנתקות
        </button>
      </form>
    </main>
  );
}
