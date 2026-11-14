import { Car, Plus } from "lucide-react";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, ScreenHeader } from "@/components/ui/Layout";
import { plural, todayInIsrael } from "@/lib/format";
import { getFamilyContext } from "@/lib/server/context";
import { signedPhotoUrls } from "@/lib/server/photos";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "כל הרכבים · ניהול רכבי המשפחה" };

export default async function VehiclesPage() {
  const ctx = await getFamilyContext();
  const isAdmin = ctx!.membership!.role === "admin";
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").eq("family_id", ctx!.membership!.familyId).order("created_at", { ascending: true });
  const list = data ?? [];
  const photos = await signedPhotoUrls(supabase, list.map((v) => v.photo_path));
  const today = todayInIsrael();

  return (
    <>
      <ScreenHeader title="הרכבים" subtitle={`${list.length} ${plural(list.length, "רכב", "רכבים")} במשפחה`}>
        {isAdmin ? (
          <LinkButton href="/vehicles/new" icon={Plus} className="w-full sm:w-auto">
            הוספת רכב
          </LinkButton>
        ) : null}
      </ScreenHeader>
      {list.length === 0 ? (
        <EmptyState icon={Car} title="עדיין אין רכבים במשפחה">
          {isAdmin ? "לחצו על ״הוספת רכב״ כדי להתחיל." : "מנהל המשפחה יכול להוסיף רכב ראשון."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => (
            <VehicleCard key={v.id} vehicle={v} today={today} photoUrl={v.photo_path ? photos.get(v.photo_path) : null} />
          ))}
        </div>
      )}
    </>
  );
}
