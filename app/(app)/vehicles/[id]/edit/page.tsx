import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { vehicleName } from "@/components/vehicles/VehicleCard";
import { ScreenHeader } from "@/components/ui/Layout";
import { getFamilyContext } from "@/lib/server/context";
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
  const ctx = await getFamilyContext();
  const photos = await signedPhotoUrls(supabase, [vehicle.photo_path]);

  return (
    <>
      <ScreenHeader title="עריכת רכב" subtitle={vehicleName(vehicle)} backHref={`/vehicles/${vehicle.id}`} />
      <VehicleForm vehicle={vehicle} familyId={ctx!.membership!.familyId} photoUrl={vehicle.photo_path ? photos.get(vehicle.photo_path) : null} />
    </>
  );
}
