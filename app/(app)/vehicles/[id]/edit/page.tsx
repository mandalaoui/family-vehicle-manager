import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { vehicleName } from "@/components/vehicles/VehicleCard";
import { ScreenHeader } from "@/components/ui/Layout";
import { requireMembership } from "@/lib/server/context";
import { signedPhotoUrls } from "@/lib/server/photos";
import { uuidSchema } from "@/lib/validation";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "עריכת רכב · ניהול רכבי המשפחה" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (!vehicle) notFound();
  const ctx = await requireMembership();
  const { count: logCount } = await supabase.from("service_logs").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicle.id);
  const photos = await signedPhotoUrls(supabase, [vehicle.photo_path]);

  return (
    <>
      <ScreenHeader title="עריכת רכב" subtitle={vehicleName(vehicle)} backHref={`/vehicles/${vehicle.id}`} />
      <VehicleForm vehicle={vehicle} hasLogs={(logCount ?? 0) > 0} familyId={ctx.membership.familyId} photoUrl={vehicle.photo_path ? photos.get(vehicle.photo_path) : null} />
    </>
  );
}
