import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getFamilyContext } from "@/lib/server/context";

// Everything under (app) is per user and per request: never prerender or cache it.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (!ctx.membership) redirect("/onboarding");

  return (
    <div className="flex-1">
      <AppHeader familyName={ctx.membership.familyName} />
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-5">{children}</main>
    </div>
  );
}
