"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardList, Pencil, Trash2, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/Layout";
import { Menu } from "@/components/ui/Menu";
import { Ltr } from "@/components/ui/Plate";
import { useToast } from "@/components/ui/Toast";
import { deleteServiceLog, restoreServiceLog } from "@/lib/actions/service";
import { formatDate, formatNumber, KM, SHEKEL } from "@/lib/format";
import type { ServiceLog } from "@/types/database";
// Downloaded only when a log is edited.
const ServiceModal = dynamic(() => import("./ServiceModal").then((m) => m.ServiceModal));

export function ServiceHistory({
  vehicleId,
  vehicleName,
  currentMileage,
  today,
  logs,
  familyGarages,
}: {
  vehicleId: string;
  vehicleName: string;
  currentMileage: number;
  today: string;
  logs: ServiceLog[];
  familyGarages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<ServiceLog | null>(null);
  const [, startTransition] = useTransition();
  const garages = [...new Set(logs.map((l) => l.garage).filter((g): g is string => Boolean(g)))];

  function remove(log: ServiceLog) {
    startTransition(async () => {
      const res = await deleteServiceLog(log.id);
      if (!res.ok) {
        toast(res.error, { type: "error" });
        return;
      }
      const { deleted } = res;
      toast(`הטיפול מ־${formatDate(log.service_date)} נמחק.`, {
        type: "info",
        action: {
          label: "ביטול",
          onClick: () =>
            startTransition(async () => {
              const back = await restoreServiceLog(deleted);
              if (!back.ok) {
                toast(back.error, { type: "error" });
                return;
              }
              toast("המחיקה בוטלה והטיפול הוחזר.");
              router.refresh();
            }),
        },
      });
      router.refresh();
    });
  }

  if (logs.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title="אין עדיין טיפולים בהיסטוריה">
        אחרי ״בוצע טיפול״ יופיע כאן רישום עם תאריך, מוסך ועלות.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="divide-y divide-silver-200">
        {logs.map((l) => (
          <li key={l.id} className="flex gap-3 py-3">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-silver-100">
              <Wrench size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">
                  <Ltr>{formatDate(l.service_date)}</Ltr>
                </span>
                {l.cost != null ? (
                  <span className="text-sm font-semibold">
                    <Ltr>
                      {SHEKEL}
                      {formatNumber(l.cost)}
                    </Ltr>
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted">
                <Ltr>{formatNumber(l.mileage)}</Ltr> {KM}
                {l.garage ? ` · ${l.garage}` : ""}
              </p>
              {l.notes ? <p className="mt-1 text-sm">{l.notes}</p> : null}
            </div>
            <Menu
              label={`פעולות עבור הטיפול מ־${formatDate(l.service_date)}`}
              items={[
                { label: "עריכת טיפול", icon: Pencil, onClick: () => setEditing(l) },
                { label: "מחיקת טיפול", icon: Trash2, danger: true, onClick: () => remove(l) },
              ]}
            />
          </li>
        ))}
      </ul>
      {editing ? (
        <ServiceModal
          key={editing.id}
          vehicleId={vehicleId}
          vehicleName={vehicleName}
          currentMileage={currentMileage}
          today={today}
          garages={garages}
          familyGarages={familyGarages}
          log={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
