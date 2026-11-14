import { VehicleCardSkeleton } from "@/components/vehicles/VehicleCard";
import { Skeleton } from "@/components/ui/Layout";

export default function Loading() {
  return (
    <div role="status" aria-label="טוען">
      <div className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="mb-3 h-6 w-28" />
      <Skeleton className="mb-8 h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
      </div>
    </div>
  );
}
