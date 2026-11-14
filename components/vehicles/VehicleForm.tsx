"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { DateInput, Field, NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { createVehicle, updateVehicle } from "@/lib/actions/vehicles";
import { COLORS, formatDate, FUEL_LABELS, KM } from "@/lib/format";
import type { Vehicle } from "@/types/database";

const dateValue = (iso: string | null | undefined) => (iso ? formatDate(iso) : "");

function initialState(v?: Vehicle) {
  return {
    nickname: v?.nickname ?? "",
    plate: v?.plate ?? "",
    make: v?.make ?? "",
    model: v?.model ?? "",
    year: v?.year ? String(v.year) : "",
    color: v?.color ?? "",
    fuel_type: v?.fuel_type ?? "",
    mileage: v ? String(v.mileage) : "",
    test_due: dateValue(v?.test_due),
    license_due: dateValue(v?.license_due),
    insurance_due: dateValue(v?.insurance_due),
    next_service_km: v?.next_service_km != null ? String(v.next_service_km) : "",
    notes: v?.notes ?? "",
  };
}

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(() => initialState(vehicle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const editing = Boolean(vehicle);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cancelHref = vehicle ? `/vehicles/${vehicle.id}` : "/";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = vehicle ? await updateVehicle(vehicle.id, f) : await createVehicle(f);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.fieldErrors ? "יש לתקן את השדות המסומנים." : res.error, { type: "error" });
        return;
      }
      const name = f.nickname.trim() || `${f.make.trim()} ${f.model.trim()}`;
      toast(editing ? "פרטי הרכב עודכנו." : `״${name}״ נוסף למשפחה.`);
      router.push(vehicle ? `/vehicles/${vehicle.id}` : `/vehicles/${"id" in res ? res.id : ""}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-base font-bold">פרטי הרכב</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="plate" label="מספר רכב" error={errors.plate} hint="7 או 8 ספרות, בלי רווחים">
            <TextInput id="plate" ltr inputMode="numeric" autoComplete="off" placeholder="לדוגמה 1234567" maxLength={10} value={f.plate} error={errors.plate} onChange={(e) => set("plate", e.target.value.replace(/[^\d-]/g, ""))} />
          </Field>
          <Field id="nickname" label="כינוי" error={errors.nickname} hint="אפשר להשאיר ריק">
            <TextInput id="nickname" value={f.nickname} error={errors.nickname} maxLength={60} placeholder="למשל: הקורולה של אבא" onChange={(e) => set("nickname", e.target.value)} />
          </Field>
          <Field id="make" label="יצרן" error={errors.make}>
            <TextInput id="make" value={f.make} error={errors.make} maxLength={40} onChange={(e) => set("make", e.target.value)} />
          </Field>
          <Field id="model" label="דגם" error={errors.model}>
            <TextInput id="model" value={f.model} error={errors.model} maxLength={40} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field id="year" label="שנת ייצור" error={errors.year} hint="אפשר להשאיר ריק">
            <NumberInput id="year" max={4} value={f.year} error={errors.year} onChange={(v) => set("year", v)} />
          </Field>
          <Field id="color" label="צבע" error={errors.color}>
            <SelectInput id="color" value={f.color} error={errors.color} onChange={(v) => set("color", v)} options={COLORS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field id="fuel_type" label="סוג דלק" error={errors.fuel_type}>
            <SelectInput id="fuel_type" value={f.fuel_type} error={errors.fuel_type} onChange={(v) => set("fuel_type", v)} options={Object.entries(FUEL_LABELS).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field id="mileage" label={`קילומטראז׳ נוכחי (${KM})`} error={errors.mileage}>
            <NumberInput id="mileage" value={f.mileage} error={errors.mileage} onChange={(v) => set("mileage", v)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-base font-bold">תאריכים וטיפול</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="test_due" label="תוקף טסט" error={errors.test_due} hint="אפשר להשאיר ריק">
            <DateInput id="test_due" value={f.test_due} error={errors.test_due} onChange={(v) => set("test_due", v)} />
          </Field>
          <Field id="license_due" label="תוקף רישוי" error={errors.license_due} hint="אפשר להשאיר ריק">
            <DateInput id="license_due" value={f.license_due} error={errors.license_due} onChange={(v) => set("license_due", v)} />
          </Field>
          <Field id="insurance_due" label="תוקף ביטוח" error={errors.insurance_due} hint="אפשר להשאיר ריק">
            <DateInput id="insurance_due" value={f.insurance_due} error={errors.insurance_due} onChange={(v) => set("insurance_due", v)} />
          </Field>
          <Field id="next_service_km" label={`טיפול הבא בקילומטראז׳ (${KM})`} error={errors.next_service_km} hint="אפשר להשאיר ריק. אחרי ״בוצע טיפול״ הערך מתעדכן לבד.">
            <NumberInput id="next_service_km" value={f.next_service_km} error={errors.next_service_km} onChange={(v) => set("next_service_km", v)} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="notes" label="הערות" error={errors.notes}>
              <TextArea id="notes" rows={3} maxLength={2000} value={f.notes} error={errors.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <LinkButton href={cancelHref} variant="neutral">
          ביטול
        </LinkButton>
        <Button type="submit" icon={Check} loading={pending} className="sm:min-w-[160px]">
          {editing ? "שמירת שינויים" : "שמירת רכב"}
        </Button>
      </div>
    </form>
  );
}
