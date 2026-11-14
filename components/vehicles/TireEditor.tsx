"use client";

import { useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateInput, Field, NumberInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Layout";
import { WHEEL_LABELS, WHEEL_ORDER, wheelStatus, type WheelKey } from "@/lib/alerts";
import { formatDate, KM, parseDMY, todayInIsrael } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import { TireDiagram, type WheelView } from "./TireDiagram";

/** All values are form strings (dates as dd/mm/yyyy), like the rest of the vehicle form. */
export interface TireState {
  tires_separate: boolean;
  tires_replaced_at: string;
  tire_fl_at: string;
  tire_fr_at: string;
  tire_rl_at: string;
  tire_rr_at: string;
  tires_replaced_km: string;
  tires_reminder_months: string;
  tires_reminder_km: string;
}

export const WHEEL_FIELD: Record<WheelKey, "tire_fl_at" | "tire_fr_at" | "tire_rl_at" | "tire_rr_at"> = {
  fl: "tire_fl_at",
  fr: "tire_fr_at",
  rl: "tire_rl_at",
  rr: "tire_rr_at",
};

const d = (iso: string | null | undefined) => (iso ? formatDate(iso) : "");

export function tireStateFromVehicle(v?: Partial<Vehicle>): TireState {
  return {
    tires_separate: v?.tires_separate ?? false,
    tires_replaced_at: d(v?.tires_replaced_at),
    tire_fl_at: d(v?.tire_fl_at),
    tire_fr_at: d(v?.tire_fr_at),
    tire_rl_at: d(v?.tire_rl_at),
    tire_rr_at: d(v?.tire_rr_at),
    tires_replaced_km: v?.tires_replaced_km != null ? String(v.tires_replaced_km) : "",
    tires_reminder_months: String(v?.tires_reminder_months ?? 48),
    tires_reminder_km: String(v?.tires_reminder_km ?? 50000),
  };
}

/** The oldest ISO date among the entered wheel dates (as dd/mm/yyyy), or "". */
export function oldestWheelDate(state: TireState): string {
  const isos = WHEEL_ORDER.map((k) => parseDMY(state[WHEEL_FIELD[k]])).filter((x): x is string => Boolean(x));
  return isos.length ? formatDate(isos.sort()[0]) : "";
}

export function TireEditor({
  value,
  onChange,
  errors = {},
  mileage,
}: {
  value: TireState;
  onChange: (patch: Partial<TireState>) => void;
  errors?: Record<string, string>;
  /** Current odometer, used for the km part of each wheel's status. */
  mileage: number;
}) {
  const [selected, setSelected] = useState<WheelKey | null>(null);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const singleDateRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => todayInIsrael(), []);
  const separate = value.tires_separate;

  const km = value.tires_replaced_km.trim() === "" ? null : Number(value.tires_replaced_km);
  const statusCtx = {
    mileage,
    tires_replaced_km: km !== null && Number.isFinite(km) ? km : null,
    tires_reminder_months: Number(value.tires_reminder_months) || 48,
    tires_reminder_km: Number(value.tires_reminder_km) || 50000,
  };

  const wheels = Object.fromEntries(
    WHEEL_ORDER.map((k) => {
      const iso = parseDMY(separate ? value[WHEEL_FIELD[k]] : value.tires_replaced_at);
      return [k, { date: iso, level: wheelStatus(iso, statusCtx, today).level } satisfies WheelView];
    }),
  ) as Record<WheelKey, WheelView>;

  const highlighted = new Set<WheelKey>(separate ? (selected ? [selected] : []) : WHEEL_ORDER);

  function selectWheel(k: WheelKey) {
    if (separate) setSelected(k);
    else singleDateRef.current?.querySelector("input")?.focus();
  }

  function toggle(next: boolean) {
    if (next) {
      // single -> separate: copy the one date to every wheel (each can be changed afterwards).
      const base = value.tires_replaced_at;
      onChange({
        tires_separate: true,
        tire_fl_at: base,
        tire_fr_at: base,
        tire_rl_at: base,
        tire_rr_at: base,
      });
      setCopiedNote(Boolean(base));
      setConfirmMerge(false);
      return;
    }
    // separate -> single: never change data silently when wheels have dates.
    if (oldestWheelDate(value)) setConfirmMerge(true);
    else {
      onChange({ tires_separate: false });
      setSelected(null);
    }
  }

  function confirmMergeNow() {
    onChange({ tires_separate: false, tires_replaced_at: oldestWheelDate(value) });
    setConfirmMerge(false);
    setSelected(null);
  }

  const reminderOpen = value.tires_replaced_km !== "" || value.tires_reminder_months !== "48" || value.tires_reminder_km !== "50000" || Boolean(errors.tires_replaced_km || errors.tires_reminder_months || errors.tires_reminder_km);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-brand" checked={separate} onChange={(e) => toggle(e.target.checked)} />
        תאריך נפרד לכל גלגל
      </label>

      {confirmMerge ? (
        <div role="alertdialog" aria-label="אישור איחוד תאריכים" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="text-sm font-bold">התאריך הישן ביותר יחול על כל הגלגלים</p>
          <p className="mt-1 text-sm">התאריכים הנפרדים יוחלפו בתאריך אחד: {oldestWheelDate(value)}. להמשיך?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="neutral" onClick={() => setConfirmMerge(false)}>
              ביטול
            </Button>
            <Button onClick={confirmMergeNow}>אישור</Button>
          </div>
        </div>
      ) : null}

      {copiedNote && separate ? (
        <Notice icon={Info}>התאריך הועתק לכל ארבעת הגלגלים. אפשר לשנות כל גלגל בנפרד.</Notice>
      ) : null}

      <TireDiagram wheels={wheels} selected={highlighted} onSelect={selectWheel} />

      {separate ? (
        selected ? (
          <Field id={WHEEL_FIELD[selected]} label={`${WHEEL_LABELS[selected]} – תאריך החלפה`} error={errors[WHEEL_FIELD[selected]]} hint="אפשר להשאיר ריק אם לא ידוע">
            <DateInput
              id={WHEEL_FIELD[selected]}
              value={value[WHEEL_FIELD[selected]]}
              error={errors[WHEEL_FIELD[selected]]}
              onChange={(v) => onChange({ [WHEEL_FIELD[selected]]: v } as Partial<TireState>)}
            />
          </Field>
        ) : (
          <p className="text-sm text-muted">לחצו על גלגל כדי להזין את תאריך ההחלפה שלו.</p>
        )
      ) : (
        <div ref={singleDateRef}>
          <Field id="tires_replaced_at" label="תאריך החלפה (כל הגלגלים)" error={errors.tires_replaced_at} hint="אפשר להשאיר ריק">
            <DateInput id="tires_replaced_at" value={value.tires_replaced_at} error={errors.tires_replaced_at} onChange={(v) => onChange({ tires_replaced_at: v })} />
          </Field>
        </div>
      )}

      {/* Wheel dates of other wheels stay visible in the diagram; errors for non-selected wheels are listed here. */}
      {separate
        ? WHEEL_ORDER.filter((k) => errors[WHEEL_FIELD[k]] && k !== selected).map((k) => (
            <p key={k} role="alert" className="text-sm font-semibold text-red-700">
              {WHEEL_LABELS[k]}: {errors[WHEEL_FIELD[k]]}
            </p>
          ))
        : null}

      <details open={reminderOpen || undefined} className="rounded-xl border border-silver-300 p-3">
        <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-bold">הגדרות תזכורת</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field id="tires_replaced_km" label={`קילומטראז׳ בהחלפה (${KM})`} error={errors.tires_replaced_km} hint="אפשר להשאיר ריק. בלי ק״מ התזכורת היא לפי חודשים בלבד.">
            <NumberInput id="tires_replaced_km" value={value.tires_replaced_km} error={errors.tires_replaced_km} onChange={(v) => onChange({ tires_replaced_km: v })} />
          </Field>
          <Field id="tires_reminder_months" label="תזכורת אחרי (חודשים)" error={errors.tires_reminder_months} hint="ברירת מחדל 48.">
            <NumberInput id="tires_reminder_months" value={value.tires_reminder_months} error={errors.tires_reminder_months} onChange={(v) => onChange({ tires_reminder_months: v })} />
          </Field>
          <Field id="tires_reminder_km" label={`או אחרי (${KM})`} error={errors.tires_reminder_km} hint="ברירת מחדל 50,000. המוקדם מביניהם, כהערכה.">
            <NumberInput id="tires_reminder_km" value={value.tires_reminder_km} error={errors.tires_reminder_km} onChange={(v) => onChange({ tires_reminder_km: v })} />
          </Field>
        </div>
      </details>
    </div>
  );
}
