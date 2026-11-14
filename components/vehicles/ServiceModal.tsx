"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateInput, Field, NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { completeService, updateServiceLog } from "@/lib/actions/service";
import { formatDate, formatNumber, KM } from "@/lib/format";
import type { ServiceLog } from "@/types/database";

export function ServiceModal({
  vehicleId,
  vehicleName,
  currentMileage,
  today,
  garages,
  familyGarages = [],
  log,
  onClose,
}: {
  vehicleId: string;
  vehicleName: string;
  currentMileage: number;
  today: string;
  garages: string[];
  /** The family garage list (optional link of the log to a garage). */
  familyGarages?: { id: string; name: string }[];
  /** When set, the modal edits this log instead of creating a new one. */
  log?: ServiceLog;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(log);
  const [date, setDate] = useState(formatDate(log?.service_date ?? today));
  const [mileage, setMileage] = useState(log ? String(log.mileage) : "");
  const [garage, setGarage] = useState(log?.garage ?? "");
  const [garageId, setGarageId] = useState(log?.garage_id ?? "");
  const [cost, setCost] = useState(log?.cost != null ? String(log.cost) : "");
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const input = { service_date: date, mileage, garage: garageId ? "" : garage, garage_id: garageId, cost, notes };
    startTransition(async () => {
      if (log) {
        const res = await updateServiceLog(log.id, input);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast(res.fieldErrors ? "יש לתקן את השדות המסומנים." : res.error, { type: "error" });
          return;
        }
        toast("הטיפול עודכן. חישוב הטיפול הבא התעדכן.");
      } else {
        const res = await completeService(vehicleId, input);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast(res.fieldErrors ? "יש לתקן את השדות המסומנים." : res.error, { type: "error" });
          return;
        }
        toast(res.nextServiceKm != null ? `הטיפול נשמר. הטיפול הבא: ב־${formatNumber(res.nextServiceKm)} ${KM}.` : "הטיפול נשמר.");
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      title={editing ? `עריכת טיפול · ${vehicleName}` : `בוצע טיפול · ${vehicleName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="service-form" icon={Check} loading={pending}>
            {editing ? "שמירת שינויים" : "שמירת טיפול"}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="s-date" label="תאריך הטיפול" error={errors.service_date}>
          <DateInput id="s-date" value={date} error={errors.service_date} onChange={setDate} />
        </Field>
        <Field id="s-km" label={`קילומטראז׳ (${KM})`} error={errors.mileage} hint={`קריאה נוכחית: ${formatNumber(currentMileage)} ${KM}`}>
          <NumberInput id="s-km" value={mileage} error={errors.mileage} onChange={setMileage} />
        </Field>
        {familyGarages.length > 0 ? (
          <div className="sm:col-span-2">
            <Field id="s-garage-id" label="מוסך מהרשימה" error={errors.garage_id} hint="אפשר לבחור מוסך מהרשימה המשפחתית, או להקליד שם אחר למטה">
              <SelectInput id="s-garage-id" value={garageId} error={errors.garage_id} onChange={setGarageId} options={familyGarages.map((g) => ({ value: g.id, label: g.name }))} placeholder="ללא (הקלדה חופשית)" />
            </Field>
          </div>
        ) : null}
        {!garageId ? (
          <div className="sm:col-span-2">
            <Field id="s-garage" label={familyGarages.length > 0 ? "או שם מוסך אחר" : "מוסך"} error={errors.garage} hint="אפשר להשאיר ריק">
              <TextInput id="s-garage" list="garage-list" autoComplete="off" maxLength={80} value={garage} error={errors.garage} onChange={(e) => setGarage(e.target.value)} placeholder="הקלידו שם מוסך" />
              <datalist id="garage-list">
                {garages.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
          </div>
        ) : null}
        <Field id="s-cost" label="עלות (₪)" error={errors.cost} hint="אפשר להשאיר ריק">
          <TextInput id="s-cost" ltr inputMode="decimal" autoComplete="off" maxLength={10} value={cost} error={errors.cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="s-notes" label="הערות" error={errors.notes}>
            <TextArea id="s-notes" rows={3} maxLength={2000} value={notes} error={errors.notes} onChange={(e) => setNotes(e.target.value)} placeholder="למשל: החלפת שמן ופילטרים" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
