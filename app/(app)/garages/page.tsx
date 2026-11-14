import { GarageManager } from "@/components/garages/GarageManager";
import { requireMembership } from "@/lib/server/context";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "מוסכים · ניהול רכבי המשפחה" };

export default async function GaragesPage() {
  const supabase = await createClient();
  const [ctx, { data }] = await Promise.all([requireMembership(), supabase.from("garages").select("*").order("name", { ascending: true })]);
  return <GarageManager garages={(data ?? []).filter((g) => g.family_id === ctx.membership.familyId)} isAdmin={ctx.membership.role === "admin"} />;
}
