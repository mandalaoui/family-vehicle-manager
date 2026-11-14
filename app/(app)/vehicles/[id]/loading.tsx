import { Skeleton } from "@/components/ui/Layout";

export default function Loading() {
  return (
    <div role="status" aria-label="טוען">
      <div className="mb-5 flex items-center gap-3">
        <Skeleton className="h-11 w-11" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-56 md:col-span-2" />
      </div>
    </div>
  );
}
