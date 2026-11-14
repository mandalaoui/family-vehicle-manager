import { revalidatePath } from "next/cache";

/** Refreshes the dashboard, the vehicle list and (when given) one vehicle's details page. */
export function revalidateVehicle(vehicleId?: string) {
  revalidatePath("/");
  revalidatePath("/vehicles");
  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`);
}
