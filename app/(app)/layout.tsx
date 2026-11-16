import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getFamilyContext } from "@/lib/server/context";

// Everything under (app) is per user and per request: never prerender or cache it.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (!ctx.membership) redirect("/join");

  const shared = ctx.membership.memberCount > 1;

  return (
    <div className="flex-1">
      <AppHeader familyName={shared ? ctx.membership.familyName : null} showSettings={shared} />
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-5">{children}</main>
    </div>
  );
}
