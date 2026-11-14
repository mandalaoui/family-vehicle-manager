import { VehicleCardSkeleton } from "@/components/vehicles/VehicleCard";
import { Skeleton } from "@/components/ui/Layout";

export default function Loading() {
  return (
    <div role="status" aria-label="טוען">
      <Skeleton className="mb-5 h-8 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
      </div>
    </div>
  );
}
