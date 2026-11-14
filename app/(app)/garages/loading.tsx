import { Skeleton } from "@/components/ui/Layout";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
