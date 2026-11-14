import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { OnboardingForms } from "@/components/OnboardingForms";
import { getFamilyContext } from "@/lib/server/context";

export const metadata = { title: "ברוכים הבאים · ניהול רכבי המשפחה" };

export default async function OnboardingPage() {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (ctx.membership) redirect("/");

  const name = (ctx.user.user_metadata?.full_name ?? ctx.user.user_metadata?.name ?? "") as string;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white">
          <Car size={30} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">{name ? `ברוכים הבאים, ${name.split(" ")[0]}` : "ברוכים הבאים"}</h1>
        <p className="text-sm text-muted">כדי להתחיל, פתחו משפחה חדשה או הצטרפו למשפחה שכבר קיימת.</p>
      </div>
      <OnboardingForms />
      <form action="/auth/signout" method="post" className="text-center">
        <button type="submit" className="min-h-[44px] text-sm font-semibold text-muted underline">
          התנתקות
        </button>
      </form>
    </main>
  );
}
