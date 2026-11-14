"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { updateMileage } from "@/lib/actions/vehicles";
import { formatDate, formatNumber, KM } from "@/lib/format";

export function MileageModal({
  vehicleId,
  mileage,
  updatedAt,
  onClose,
}: {
  vehicleId: string;
  mileage: number;
  updatedAt: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await updateMileage(vehicleId, value);
      if (!res.ok) {
        setError(res.fieldErrors?.mileage ?? res.error);
        toast(res.error, { type: "error" });
        return;
      }
      toast(`הקילומטראז׳ עודכן ל־${formatNumber(res.mileage)} ${KM}.`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      title="עדכון קילומטראז׳"
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="mileage-form" icon={Check} loading={pending}>
            שמירה
          </Button>
        </>
      }
    >
      <form id="mileage-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id="m-km" label={`קילומטראז׳ (${KM})`} error={error} hint={`קריאה אחרונה: ${formatNumber(mileage)} ${KM}, ${formatDate(updatedAt)}`}>
          <NumberInput id="m-km" value={value} error={error} onChange={setValue} />
        </Field>
      </form>
    </Modal>
  );
}
