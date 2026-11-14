import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getFamilyContext } from "@/lib/server/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getFamilyContext();
  if (!ctx) redirect("/login");
  if (!ctx.membership) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <AppHeader familyName={ctx.membership.familyName} />
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-5">{children}</main>
    </div>
  );
}
