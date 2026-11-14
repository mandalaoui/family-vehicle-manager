"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { updateBattery } from "@/lib/actions/battery-tires";
import type { Vehicle } from "@/types/database";
import { BatteryFields, batteryStateFromVehicle, type BatteryState } from "./BatteryFields";

export type BatteryVehicle = Pick<Vehicle, "id" | "battery_replaced_at" | "battery_warranty_until" | "battery_notes" | "battery_reminder_months">;

function BatteryModal({ vehicle, onClose }: { vehicle: BatteryVehicle; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<BatteryState>(() => batteryStateFromVehicle(vehicle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function patch(p: Partial<BatteryState>) {
    setF((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await updateBattery(vehicle.id, f);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.fieldErrors ? "יש לתקן את השדות המסומנים." : res.error, { type: "error" });
        return;
      }
      toast("פרטי המצבר עודכנו.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      title="עריכת מצבר"
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="battery-form" icon={Check} loading={pending}>
            שמירה
          </Button>
        </>
      }
    >
      <form id="battery-form" onSubmit={submit} noValidate>
        <BatteryFields value={f} onChange={patch} errors={errors} />
      </form>
    </Modal>
  );
}

/** Edit button for the battery card; opens a focused modal (no page navigation). */
export function BatteryEdit({ vehicle }: { vehicle: BatteryVehicle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neutral" icon={Pencil} onClick={() => setOpen(true)} aria-label="עריכת פרטי המצבר">
        עריכה
      </Button>
      {open ? <BatteryModal vehicle={vehicle} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
