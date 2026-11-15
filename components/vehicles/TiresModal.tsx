"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { updateTires } from "@/lib/actions/battery-tires";
import type { Vehicle } from "@/types/database";
import { TireEditor, tireStateFromVehicle, type TireState } from "./TireEditor";

export type TiresVehicle = Pick<
  Vehicle,
  | "id"
  | "mileage"
  | "tires_separate"
  | "tires_replaced_at"
  | "tire_fl_at"
  | "tire_fr_at"
  | "tire_rl_at"
  | "tire_rr_at"
  | "tires_replaced_km"
  | "tires_reminder_months"
  | "tires_reminder_km"
>;

export function TiresModal({ vehicle, onClose }: { vehicle: TiresVehicle; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<TireState>(() => tireStateFromVehicle(vehicle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function patch(p: Partial<TireState>) {
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
      const res = await updateTires(vehicle.id, f);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.fieldErrors ? "יש לתקן את השדות המסומנים." : res.error, { type: "error" });
        return;
      }
      toast("פרטי הצמיגים עודכנו.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      title="עריכת צמיגים"
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="tires-form" icon={Check} loading={pending}>
            שמירה
          </Button>
        </>
      }
    >
      <form id="tires-form" onSubmit={submit} noValidate>
        <TireEditor value={f} onChange={patch} errors={errors} mileage={vehicle.mileage} />
      </form>
    </Modal>
  );
}
