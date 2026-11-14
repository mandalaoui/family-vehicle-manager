import Link from "next/link";
import { BatteryCharging, ChevronLeft, CircleCheck, CircleDot, FileCheck, Gauge, Plus, ShieldCheck, Wrench, Car, type LucideIcon } from "lucide-react";
import { VehicleCard, vehicleName } from "@/components/vehicles/VehicleCard";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, ScreenHeader } from "@/components/ui/Layout";
import { Plate } from "@/components/ui/Plate";
import { Status } from "@/components/ui/Status";
import { actionableAlerts, compareAlerts, getVehicleAlerts, type AlertKind } from "@/lib/alerts";
import { plural, todayInIsrael } from "@/lib/format";
import { requireMembership } from "@/lib/server/context";
import { signedPhotoUrls } from "@/lib/server/photos";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "רכבים · ניהול רכבי המשפחה" };

const ALERT_ICONS: Record<AlertKind, LucideIcon> = {
  license: FileCheck,
  insurance: ShieldCheck,
  service: Wrench,
  mileage: Gauge,
  battery: BatteryCharging,
  tires: CircleDot,
};

export default async function DashboardPage() {
  const ctx = await requireMembership();
  const membership = ctx.membership;
  const isAdmin = membership.role === "admin";
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("*").eq("family_id", membership.familyId).order("created_at", { ascending: true });
  const list = vehicles ?? [];
  const photos = await signedPhotoUrls(supabase, list.map((v) => v.photo_path));
  const today = todayInIsrael();

  const rows = list
    .flatMap((v) => actionableAlerts(getVehicleAlerts(v, today)).map((a) => ({ vehicle: v, alert: a })))
    .sort((a, b) => compareAlerts(a.alert, b.alert));

  return (
    <>
      <ScreenHeader
        title={membership.familyName}
        subtitle={`${list.length} ${plural(list.length, "רכב", "רכבים")} · ${rows.length} ${plural(rows.length, "פעולה פתוחה", "פעולות פתוחות")}`}
      >
        {isAdmin ? (
          <LinkButton href="/vehicles/new" icon={Plus} className="w-full sm:w-auto">
            הוספת רכב
          </LinkButton>
        ) : null}
      </ScreenHeader>

      <section aria-labelledby="actions-h" className="mb-8">
        <h2 id="actions-h" className="mb-3 text-lg font-bold">
          דורש טיפול
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-green-300 bg-green-50 p-5">
            <div className="flex items-center gap-3 text-green-900">
              <CircleCheck size={24} aria-hidden />
              <div>
                <p className="font-bold">הכול תקין</p>
                <p className="text-sm">אין כרגע רישוי, טסט, ביטוח או טיפול שדורשים תשומת לב.</p>
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-silver-200 overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-sm">
            {rows.map(({ vehicle, alert }) => {
              const Icon = ALERT_ICONS[alert.kind];
              return (
                <li key={`${vehicle.id}-${alert.kind}`}>
                  <Link href={`/vehicles/${vehicle.id}`} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-silver-50">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-silver-100">
                      <Icon size={20} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Status level={alert.level} />
                        <span className="font-semibold">{alert.title}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {vehicleName(vehicle)} · <Plate plate={vehicle.plate} />
                      </p>
                      <p className="text-sm">{alert.detail}</p>
                    </div>
                    <ChevronLeft size={20} className="shrink-0 text-gray-500" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="cars-h">
        <h2 id="cars-h" className="mb-3 text-lg font-bold">
          הרכבים שלנו
        </h2>
        {list.length === 0 ? (
          <EmptyState icon={Car} title="עדיין אין רכבים במשפחה">
            {isAdmin ? "לחצו על ״הוספת רכב״ והזינו את הפרטים כדי להתחיל לעקוב אחרי רישוי וטיפולים." : "מנהל המשפחה יכול להוסיף רכב ראשון."}
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((v) => (
              <VehicleCard key={v.id} vehicle={v} today={today} photoUrl={v.photo_path ? photos.get(v.photo_path) : null} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
