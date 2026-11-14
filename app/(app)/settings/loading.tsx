import { Skeleton } from "@/components/ui/Layout";

export default function Loading() {
  return (
    <div role="status" aria-label="טוען">
      <div className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
