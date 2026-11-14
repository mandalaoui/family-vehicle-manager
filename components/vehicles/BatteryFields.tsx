"use client";

import { DateInput, Field, NumberInput, TextArea } from "@/components/ui/Field";
import type { Vehicle } from "@/types/database";
import { formatDate } from "@/lib/format";

export interface BatteryState {
  battery_replaced_at: string;
  battery_warranty_until: string;
  battery_notes: string;
  battery_reminder_months: string;
}

export function batteryStateFromVehicle(v?: Partial<Vehicle>): BatteryState {
  return {
    battery_replaced_at: v?.battery_replaced_at ? formatDate(v.battery_replaced_at) : "",
    battery_warranty_until: v?.battery_warranty_until ? formatDate(v.battery_warranty_until) : "",
    battery_notes: v?.battery_notes ?? "",
    battery_reminder_months: String(v?.battery_reminder_months ?? 36),
  };
}

/** Battery fields, shared by the quick-edit modal and the full vehicle form. */
export function BatteryFields({
  value,
  onChange,
  errors = {},
}: {
  value: BatteryState;
  onChange: (patch: Partial<BatteryState>) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="battery_replaced_at" label="תאריך החלפת מצבר" error={errors.battery_replaced_at} hint="אפשר להשאיר ריק">
        <DateInput id="battery_replaced_at" value={value.battery_replaced_at} error={errors.battery_replaced_at} onChange={(v) => onChange({ battery_replaced_at: v })} />
      </Field>
      <Field id="battery_warranty_until" label="תוקף אחריות" error={errors.battery_warranty_until} hint="אפשר להשאיר ריק. מוצג כמידע בלבד.">
        <DateInput id="battery_warranty_until" value={value.battery_warranty_until} error={errors.battery_warranty_until} onChange={(v) => onChange({ battery_warranty_until: v })} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="battery_reminder_months" label="תזכורת לבדיקה אחרי (חודשים)" error={errors.battery_reminder_months} hint="ברירת מחדל 36. התזכורת היא הערכה בלבד.">
          <NumberInput id="battery_reminder_months" value={value.battery_reminder_months} error={errors.battery_reminder_months} onChange={(v) => onChange({ battery_reminder_months: v })} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="battery_notes" label="הערות" error={errors.battery_notes}>
          <TextArea id="battery_notes" rows={3} maxLength={1000} value={value.battery_notes} error={errors.battery_notes} onChange={(e) => onChange({ battery_notes: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
