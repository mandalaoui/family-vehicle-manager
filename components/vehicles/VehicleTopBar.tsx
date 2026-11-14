"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Gauge, Pencil, RefreshCw, Trash2, TriangleAlert, Undo2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/Layout";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteVehicle, renewDue, undoRenewDue } from "@/lib/actions/vehicles";
import { daysBetween, formatDate } from "@/lib/format";
import type { RenewalUndoEntry } from "@/types/database";

type RenewField = "test_due" | "license_due";
import { MileageModal } from "./MileageModal";
import { ServiceModal } from "./ServiceModal";

const FIELD_LABEL: Record<RenewField, string> = { test_due: "הטסט", license_due: "הרישוי" };
const RENEW_WINDOW_DAYS = 60;

interface TopBarVehicle {
  id: string;
  name: string;
  mileage: number;
  mileage_updated_at: string;
  test_due: string | null;
  license_due: string | null;
}

export function VehicleTopBar({
  vehicle: v,
  subtitle,
  isAdmin,
  today,
  staleAge,
  garages,
  undo,
}: {
  vehicle: TopBarVehicle;
  subtitle: React.ReactNode;
  isAdmin: boolean;
  today: string;
  /** Days since the last mileage reading when it is stale, otherwise null. */
  staleAge: number | null;
  garages: string[];
  /** Active (recent, still applicable) renewal undo info, computed by the server. */
  undo: Record<RenewField, RenewalUndoEntry | null>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<"service" | "mileage" | "delete" | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function undoRenew(field: RenewField) {
    startTransition(async () => {
      const res = await undoRenewDue(v.id, field);
      if (!res.ok) {
        toast(res.error, { type: "error" });
        return;
      }
      toast(`החידוש בוטל. תוקף ${FIELD_LABEL[field]} חזר ל־${formatDate(res.restoredTo)}.`, { type: "info" });
      router.refresh();
    });
  }

  function renew(field: RenewField) {
    startTransition(async () => {
      const res = await renewDue(v.id, field);
      if (!res.ok) {
        toast(res.error, { type: "error" });
        return;
      }
      toast(`${FIELD_LABEL[field]} סומן כחודש. תוקף חדש: ${formatDate(res.next)}.`, {
        action: { label: "ביטול", onClick: () => undoRenew(field) },
      });
      router.refresh();
    });
  }

  function remove() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteVehicle(v.id);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      toast(`״${v.name}״ נמחק.`);
      router.replace("/");
      router.refresh();
    });
  }

  const items: MenuItem[] = [];
  for (const field of ["license_due", "test_due"] as const) {
    const due = v[field];
    if (due && daysBetween(today, due) <= RENEW_WINDOW_DAYS) {
      items.push({ label: `סימון ${FIELD_LABEL[field]} כחודש`, icon: RefreshCw, onClick: () => renew(field) });
    }
  }
  for (const field of ["license_due", "test_due"] as const) {
    const entry = undo[field];
    if (entry) {
      items.push({
        label: `ביטול חידוש ${FIELD_LABEL[field]} (חזרה ל־${formatDate(entry.previous)})`,
        icon: Undo2,
        onClick: () => undoRenew(field),
      });
    }
  }
  items.push({ label: "עריכת פרטי הרכב", icon: Pencil, onClick: () => router.push(`/vehicles/${v.id}/edit`) });
  if (isAdmin) items.push({ label: "מחיקת הרכב", icon: Trash2, danger: true, onClick: () => setModal("delete") });

  return (
    <>
      <ScreenHeader title={v.name} subtitle={subtitle} backHref="/">
        <Button icon={Wrench} onClick={() => setModal("service")} disabled={pending}>
          בוצע טיפול
        </Button>
        <Button variant="secondary" icon={Gauge} onClick={() => setModal("mileage")}>
          עדכון קילומטראז׳
        </Button>
        <Menu items={items} />
      </ScreenHeader>

      {staleAge !== null ? (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <TriangleAlert size={22} className="mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-bold">עדכנו קילומטראז׳. הקריאה האחרונה בת {staleAge} ימים.</p>
            <p className="text-sm">עדכנו את הקילומטראז׳ כדי שהתזכורות לטיפול יהיו מדויקות.</p>
            <button type="button" onClick={() => setModal("mileage")} className="mt-1 min-h-[44px] font-semibold underline">
              עדכון עכשיו
            </button>
          </div>
        </div>
      ) : null}

      {modal === "mileage" ? (
        <MileageModal vehicleId={v.id} mileage={v.mileage} updatedAt={v.mileage_updated_at} onClose={() => setModal(null)} />
      ) : null}
      {modal === "service" ? (
        <ServiceModal vehicleId={v.id} vehicleName={v.name} currentMileage={v.mileage} today={today} garages={garages} onClose={() => setModal(null)} />
      ) : null}
      {modal === "delete" ? (
        <ConfirmModal
          title="מחיקת רכב"
          danger
          confirmLabel="מחיקה"
          pending={pending}
          error={deleteError}
          onClose={() => setModal(null)}
          onConfirm={remove}
          body={`למחוק את ״${v.name}״? היסטוריית הטיפולים והקילומטראז׳ יימחקו ולא ניתן לשחזר אותם.`}
        />
      ) : null}
    </>
  );
}
