import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RefreshMinistryButton } from "@/components/vehicles/RefreshMinistryButton";
import { VehicleImage } from "@/components/vehicles/VehicleImage";
import { VehiclePhotoControl } from "@/components/vehicles/VehiclePhotoControl";
import { signedPhotoUrls } from "@/lib/server/photos";
import { LastTestInfo } from "@/components/vehicles/LastTestInfo";
import Link from "next/link";
import { ClipboardList, FileCheck, Gauge, ShieldPlus, StickyNote, Wrench } from "lucide-react";
import { vehicleName } from "@/components/vehicles/VehicleCard";
import { ServiceHistory } from "@/components/vehicles/ServiceHistory";
import { VehicleTopBar } from "@/components/vehicles/VehicleTopBar";
import { Row, Section } from "@/components/ui/Layout";
import { Ltr, Plate } from "@/components/ui/Plate";
import { Status } from "@/components/ui/Status";
import { describeDays, estimateService, isMileageStale, serviceLevel } from "@/lib/alerts";
import { daysBetween, formatDate, formatNumber, FUEL_LABELS, KM, todayInIsrael } from "@/lib/format";
import { getFamilyContext } from "@/lib/server/context";
import { uuidSchema } from "@/lib/validation";
import { createClient } from "@/utils/supabase/server";
import { dateLevel } from "@/lib/alerts";
import { activeUndo } from "@/lib/renew";

export const metadata = { title: "פרטי רכב · ניהול רכבי המשפחה" };

function DueRow({ label, due, today }: { label: string; due: string | null; today: string }) {
  if (!due) {
    return (
      <Row label={label}>
        <span className="font-medium text-muted">לא הוזן</span>
      </Row>
    );
  }
  const days = daysBetween(today, due);
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-sm font-semibold">
          <Ltr>{formatDate(due)}</Ltr>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Status level={dateLevel(days)} />
        <span className="text-sm text-muted">{describeDays(days)}</span>
      </div>
    </div>
  );
}

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const ctx = await getFamilyContext();
  const isAdmin = ctx!.membership!.role === "admin";
  const supabase = await createClient();

  const [{ data: v }, { data: logs }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    supabase.from("service_logs").select("*").eq("vehicle_id", id).order("service_date", { ascending: false }).order("mileage", { ascending: false }),
  ]);
  if (!v) notFound();

  const photos = await signedPhotoUrls(supabase, [v.photo_path]);
  const photoUrl = v.photo_path ? photos.get(v.photo_path) : null;
  const today = todayInIsrael();
  const name = vehicleName(v);
  const age = daysBetween(v.mileage_updated_at, today);
  const stale = isMileageStale(v, today);
  const estimate = estimateService(v, today);
  const kmLeft = v.next_service_km != null ? v.next_service_km - v.mileage : null;
  const garages = [...new Set((logs ?? []).map((l) => l.garage).filter((g): g is string => Boolean(g)))];

  return (
    <>
      <VehicleTopBar
        vehicle={{
          id: v.id,
          name,
          mileage: v.mileage,
          mileage_updated_at: v.mileage_updated_at,
          license_due: v.license_due,
        }}
        isAdmin={isAdmin}
        today={today}
        staleAge={stale ? age : null}
        garages={garages}
        undo={activeUndo(v, today)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {v.make} {v.model}
              {v.year ? (
                <>
                  {" · "}
                  <Ltr>{v.year}</Ltr>
                </>
              ) : null}
              {v.color ? ` · ${v.color}` : ""}
              {v.fuel_type ? ` · ${FUEL_LABELS[v.fuel_type]}` : ""}
            </span>
            <Plate plate={v.plate} />
          </span>
        }
      />

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-silver-300 bg-white p-3 shadow-sm">
        <VehicleImage photoUrl={photoUrl} color={v.color} make={v.make} compact alt={name} className="h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-40" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm font-semibold">{photoUrl ? "תמונת הרכב" : "אין תמונה. מוצג איור לפי צבע הרכב"}</p>
          <VehiclePhotoControl vehicleId={v.id} familyId={ctx!.membership!.familyId} hasPhoto={Boolean(photoUrl)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={Wrench} title="עבודות קרובות">
          {kmLeft === null || v.next_service_km === null ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Status level={estimate.level} />
                <span className="inline-flex items-center gap-1 rounded-full border border-silver-300 bg-silver-50 px-2.5 py-0.5 text-xs font-bold">הערכה</span>
                <span className="text-sm font-semibold">
                  טיפול תקופתי כל <Ltr>{formatNumber(v.service_interval_km)}</Ltr> {KM}
                </span>
              </div>
              <div className="rounded-xl border border-dashed border-brand bg-brand-50 p-3">
                <p className="text-sm text-muted">הטיפול הבא (הערכה), המוקדם מביניהם:</p>
                <p className="font-bold">
                  <Ltr>{formatNumber(estimate.nextKm)}</Ltr> {KM} · עוד <Ltr>{formatNumber(estimate.kmLeft)}</Ltr> {KM}
                </p>
                <p className="font-bold">
                  עד <Ltr>{formatDate(estimate.nextDate)}</Ltr> <span className="text-sm font-normal text-muted">({describeDays(estimate.daysLeft)})</span>
                </p>
              </div>
              <p className="mt-2 text-xs text-muted">זו הערכה בלבד, לפי הקילומטראז׳ הנוכחי ומרווח הטיפול. לחצו על ״בוצע טיפול״ כדי לתעד טיפול אמיתי והחישוב יתעדכן.</p>
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Status level={serviceLevel(kmLeft)} />
                <span className="text-sm font-semibold">
                  טיפול תקופתי כל <Ltr>{formatNumber(v.service_interval_km)}</Ltr> {KM}
                </span>
              </div>
              <div className="rounded-xl border border-brand bg-brand-50 p-3">
                <p className="text-sm text-muted">הטיפול הבא בקילומטראז׳</p>
                <p className="font-bold">
                  <Ltr>{formatNumber(v.next_service_km)}</Ltr> {KM}
                </p>
                <p className="text-sm text-muted">
                  {kmLeft > 0 ? (
                    <>
                      נותרו <Ltr>{formatNumber(kmLeft)}</Ltr> {KM}
                    </>
                  ) : (
                    <>
                      חריגה של <Ltr>{formatNumber(-kmLeft)}</Ltr> {KM}
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          <div className="mt-3 border-t border-silver-200 pt-3">
            {v.insurance_due ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">חידוש ביטוח</span>
                  <span className="text-sm font-semibold">
                    <Ltr>{formatDate(v.insurance_due)}</Ltr>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Status level={dateLevel(daysBetween(today, v.insurance_due))} />
                  <span className="text-sm text-muted">{describeDays(daysBetween(today, v.insurance_due))}</span>
                </div>
              </>
            ) : (
              <Link href={`/vehicles/${v.id}/edit`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl text-sm font-semibold text-brand underline">
                <ShieldPlus size={18} aria-hidden />
                הוסף תוקף ביטוח
              </Link>
            )}
          </div>
        </Section>

        <Section icon={FileCheck} title="טסט ורישוי" action={<RefreshMinistryButton vehicleId={v.id} />}>
          <div className="divide-y divide-silver-200">
            <DueRow label="תוקף טסט ורישוי" due={v.license_due} today={today} />
            <Suspense fallback={null}>
              <LastTestInfo plate={v.plate} />
            </Suspense>
          </div>
        </Section>

        <Section icon={Gauge} title="קילומטראז׳">
          <p className="text-3xl font-bold tabular-nums">
            <Ltr>{formatNumber(v.mileage)}</Ltr> <span className="text-base font-semibold text-muted">{KM}</span>
          </p>
          <p className="text-sm text-muted">
            עודכן ב־<Ltr>{formatDate(v.mileage_updated_at)}</Ltr>
            {age > 0 ? ` · לפני ${age} ימים` : " · היום"}
          </p>
        </Section>

        {v.notes ? (
          <Section icon={StickyNote} title="הערות">
            <p className="whitespace-pre-wrap break-words text-sm">{v.notes}</p>
          </Section>
        ) : null}

        <Section icon={ClipboardList} title="היסטוריית טיפולים" className="md:col-span-2">
          <ServiceHistory vehicleId={v.id} vehicleName={name} currentMileage={v.mileage} today={today} logs={logs ?? []} />
        </Section>
      </div>
    </>
  );
}
