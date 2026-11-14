import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { vehicleName } from "@/components/vehicles/VehicleCard";
import { ScreenHeader } from "@/components/ui/Layout";
import { uuidSchema } from "@/lib/validation";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "עריכת רכב · ניהול רכבי המשפחה" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (!vehicle) notFound();

  return (
    <>
      <ScreenHeader title="עריכת רכב" subtitle={vehicleName(vehicle)} backHref={`/vehicles/${vehicle.id}`} />
      <VehicleForm vehicle={vehicle} />
    </>
  );
}
