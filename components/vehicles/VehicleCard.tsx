import Link from "next/link";
import { Car, Gauge } from "lucide-react";
import { actionableAlerts, getVehicleAlerts } from "@/lib/alerts";
import { COLOR_HEX, formatDate, formatNumber, KM } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import { Ltr, Plate } from "@/components/ui/Plate";
import { Status } from "@/components/ui/Status";

export const vehicleName = (v: Pick<Vehicle, "nickname" | "make" | "model">) => v.nickname?.trim() || `${v.make} ${v.model}`;

function PhotoPlaceholder({ color }: { color: string | null }) {
  return (
    <div className="relative grid h-32 place-items-center bg-silver-100">
      <div className="flex flex-col items-center gap-1 text-gray-500">
        <Car size={52} aria-hidden />
        <span className="text-xs">מקום לתמונה</span>
      </div>
      {color ? (
        <span className="absolute bottom-2 start-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium shadow-sm">
          <span className="h-3 w-3 rounded-full border border-gray-400" style={{ background: COLOR_HEX[color] ?? COLOR_HEX["אחר"] }} aria-hidden />
          {color}
        </span>
      ) : null}
    </div>
  );
}

export function VehicleCard({ vehicle: v, today }: { vehicle: Vehicle; today: string }) {
  const alerts = actionableAlerts(getVehicleAlerts(v, today));
  const next = alerts[0];
  return (
    <Link
      href={`/vehicles/${v.id}`}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-silver-300 bg-white text-start shadow-sm transition-shadow hover:shadow-md"
    >
      <PhotoPlaceholder color={v.color} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-bold">{vehicleName(v)}</h3>
            <p className="text-sm text-muted">
              {v.make} {v.model}
              {v.year ? (
                <>
                  {" · "}
                  <Ltr>{v.year}</Ltr>
                </>
              ) : null}
            </p>
          </div>
          <Plate plate={v.plate} />
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <Gauge size={16} className="text-muted" aria-hidden />
          <Ltr>{formatNumber(v.mileage)}</Ltr> {KM}
          <span className="text-muted">
            · עודכן <Ltr>{formatDate(v.mileage_updated_at)}</Ltr>
          </span>
        </p>
        <div className="mt-auto border-t border-silver-200 pt-3">
          <p className="text-xs font-semibold text-muted">הפעולה הבאה</p>
          {next ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Status level={next.level} />
                <span className="text-sm font-semibold">{next.title}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{next.detail}</p>
            </>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Status level="ok" />
              <span className="text-sm text-muted">אין כרגע פעולות פתוחות</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-sm" aria-hidden>
      <div className="skeleton h-32 rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-10 w-full" />
      </div>
    </div>
  );
}
