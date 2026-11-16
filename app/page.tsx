import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { getFamilyContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ניהול רכבי המשפחה",
  description: "מעקב משפחתי אחרי רישוי, טיפולים וקילומטראז׳ של הרכבים.",
};

export default async function LandingPage() {
  const ctx = await getFamilyContext();
  if (ctx?.membership) redirect("/home");
  if (ctx) redirect("/onboarding");

  return (
    <main className="mx-auto flex flex-1 max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-silver-300 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white">
          <Car size={30} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">ניהול רכבי המשפחה</h1>
        <p className="mt-2 text-sm text-muted">מעקב משפחתי אחרי רישוי, טיפולים וקילומטראז׳ של הרכבים.</p>
        <div className="mt-6">
          <LinkButton href="/login" className="w-full">
            התחברות
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
