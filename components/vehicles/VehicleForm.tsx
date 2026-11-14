"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Info, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { DateInput, Field, NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/ui/Toast";
import { createVehicle, updateVehicle } from "@/lib/actions/vehicles";
import { COLORS, digitsOnly, formatDate, FUEL_LABELS, KM } from "@/lib/format";
import type { MinistryVehicle } from "@/lib/ministry-map";
import { uploadVehiclePhoto } from "@/lib/upload-photo";
import { PhotoPicker } from "./PhotoPicker";
import { VehicleImage } from "./VehicleImage";
import type { Vehicle } from "@/types/database";

type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; lastTest: string | null }
  | { state: "not_found" | "unavailable"; message: string };

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
    license_due: dateValue(v?.license_due),
    insurance_due: dateValue(v?.insurance_due),
    next_service_km: v?.next_service_km != null ? String(v.next_service_km) : "",
    service_interval_km: String(v?.service_interval_km ?? 10000),
    last_service_date: "",
    last_service_km: "",
    notes: v?.notes ?? "",
  };
}

export function VehicleForm({ vehicle, familyId, photoUrl, hasLogs = false }: { vehicle?: Vehicle; familyId: string; photoUrl?: string | null; hasLogs?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(() => initialState(vehicle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const editing = Boolean(vehicle);

  useEffect(() => () => clearTimeout(timer.current), []);
  const photoUrlRef = useRef<string | null>(null);
  useEffect(() => () => { if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current); }, []);

  function pickPhoto(blob: Blob) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(blob);
    photoUrlRef.current = url;
    setPhoto({ blob, url });
  }

  // Prefill from the Ministry of Transport. Every field stays editable afterwards.
  function apply(m: MinistryVehicle) {
    // Programmatic prefill: stale "required" errors for the filled fields no longer apply.
    clearErrors("make", "model", "year", "color", "fuel_type", "license_due");
    setF((p) => ({
      ...p,
      make: m.make || p.make,
      model: m.model || p.model,
      year: m.year ? String(m.year) : p.year,
      color: m.color ?? p.color,
      fuel_type: m.fuel_type ?? p.fuel_type,
      license_due: m.valid_until ? formatDate(m.valid_until) : p.license_due,
    }));
  }

  async function runLookup(digits: string) {
    const mine = ++seq.current;
    setLookup({ state: "loading" });
    try {
      const res = await fetch(`/api/plate/${digits}`, { signal: AbortSignal.timeout(15000) });
      if (res.redirected) {
        // The session expired and the proxy redirected the request to /login.
        if (mine === seq.current) setLookup({ state: "unavailable", message: "ההתחברות פגה. רעננו את הדף והתחברו שוב. אפשר גם להזין ידנית." });
        return;
      }
      const body = (await res.json()) as { ok: boolean; code?: string; error?: string; vehicle?: MinistryVehicle };
      if (mine !== seq.current) return;
      if (body.ok && body.vehicle) {
        apply(body.vehicle);
        setLookup({ state: "found", lastTest: body.vehicle.last_test });
      } else {
        setLookup({
          state: body.code === "not_found" ? "not_found" : "unavailable",
          message: body.error ?? "לא הצלחנו לשלוף את הפרטים. אפשר להזין ידנית.",
        });
      }
    } catch {
      if (mine === seq.current) {
        setLookup({ state: "unavailable", message: "שירות משרד התחבורה לא זמין או איטי כרגע. אפשר להזין את הפרטים ידנית." });
      }
    }
  }

  function onPlate(value: string) {
    const clean = value.replace(/[^\d-]/g, "");
    set("plate", clean);
    clearTimeout(timer.current);
    seq.current++;
    const digits = digitsOnly(clean);
    if (editing || digits.length < 7 || digits.length > 8) {
      setLookup({ state: "idle" });
      return;
    }
    timer.current = setTimeout(() => runLookup(digits), 600);
  }
  // Editing a field clears its error: errors only appear after a submit attempt and go away as the user fixes them.
  const clearErrors = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    clearErrors(k);
  };
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
      const vid = vehicle?.id ?? (res as { id?: string }).id ?? "";
      if (photo && vid) {
        const up = await uploadVehiclePhoto(familyId, vid, photo.blob);
        if (!up.ok) toast(`הרכב נשמר, אבל ${up.error}`, { type: "error" });
      }
      if ("warning" in res && res.warning) toast(res.warning, { type: "error" });
      const name = f.nickname.trim() || `${f.make.trim()} ${f.model.trim()}`;
      toast(editing ? "פרטי הרכב עודכנו." : `״${name}״ נוסף למשפחה.`);
      router.push(`/vehicles/${vid}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className="rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-base font-bold">פרטי הרכב</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 sm:col-span-2">
            <VehicleImage photoUrl={photo?.url ?? photoUrl} color={f.color || null} make={f.make || null} compact alt="תמונת הרכב" className="h-24 w-28 shrink-0 overflow-hidden rounded-xl" />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-sm font-semibold">תמונה (אופציונלי)</p>
              <PhotoPicker iconOnly onPick={pickPhoto} onError={(m) => toast(m, { type: "error" })} cameraLabel="צילום תמונה" />
              <p className="text-xs text-muted">בלי תמונה מוצג איור לפי צבע הרכב.</p>
            </div>
          </div>
          <Field id="plate" label="מספר רכב" error={errors.plate} hint="7 או 8 ספרות, בלי רווחים">
            <TextInput id="plate" ltr inputMode="numeric" autoComplete="off" placeholder="לדוגמה 1234567" maxLength={10} value={f.plate} error={errors.plate} onChange={(e) => onPlate(e.target.value)} />
          </Field>
          <Field id="nickname" label="כינוי" error={errors.nickname} hint="אפשר להשאיר ריק">
            <TextInput id="nickname" value={f.nickname} error={errors.nickname} maxLength={60} placeholder="למשל: הקורולה של אבא" onChange={(e) => set("nickname", e.target.value)} />
          </Field>
          {lookup.state !== "idle" ? (
            <div className="sm:col-span-2" aria-live="polite">
              {lookup.state === "loading" ? (
                <Notice icon={LoaderCircle}>מחפשים את הרכב במאגר משרד התחבורה…</Notice>
              ) : lookup.state === "found" ? (
                <Notice tone="success" icon={ShieldCheck}>
                  נמשך ממאגר משרד התחבורה. אפשר לערוך כל שדה לפני השמירה.
                  {lookup.lastTest ? ` טסט אחרון: ${formatDate(lookup.lastTest)}.` : ""}
                </Notice>
              ) : (
                <Notice tone="warn" icon={lookup.state === "not_found" ? Info : TriangleAlert}>
                  {lookup.message}
                  {lookup.state === "not_found" ? ". אפשר להמשיך ולהזין את הפרטים ידנית." : ""}
                </Notice>
              )}
            </div>
          ) : null}
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
          <Field id="license_due" label="תוקף טסט ורישוי" error={errors.license_due} hint="תאריך אחד: חידוש הרישוי השנתי מחייב מעבר טסט. אפשר להשאיר ריק.">
            <DateInput id="license_due" value={f.license_due} error={errors.license_due} onChange={(v) => set("license_due", v)} />
          </Field>
          <Field id="insurance_due" label="תוקף ביטוח" error={errors.insurance_due} hint="אפשר להשאיר ריק">
            <DateInput id="insurance_due" value={f.insurance_due} error={errors.insurance_due} onChange={(v) => set("insurance_due", v)} />
          </Field>
          <Field id="next_service_km" label={`טיפול הבא בקילומטראז׳ (${KM})`} error={errors.next_service_km} hint="אפשר להשאיר ריק. אחרי ״בוצע טיפול״ הערך מתעדכן לבד.">
            <NumberInput id="next_service_km" value={f.next_service_km} error={errors.next_service_km} onChange={(v) => set("next_service_km", v)} />
          </Field>
          <Field id="service_interval_km" label={`מרווח בין טיפולים (${KM})`} error={errors.service_interval_km} hint="ברירת מחדל 10,000. משפיע על ההערכה ועל חישוב הטיפול הבא.">
            <NumberInput id="service_interval_km" value={f.service_interval_km} error={errors.service_interval_km} onChange={(v) => set("service_interval_km", v)} />
          </Field>
          {!hasLogs ? (
            <>
              <Field id="last_service_date" label="טיפול אחרון – תאריך" error={errors.last_service_date} hint="אפשר להשאיר ריק. אם ימולא, יתועד טיפול ראשון והטיפול הבא יחושב ממנו.">
                <DateInput id="last_service_date" value={f.last_service_date} error={errors.last_service_date} onChange={(v) => set("last_service_date", v)} />
              </Field>
              <Field id="last_service_km" label={`טיפול אחרון – ${KM}`} error={errors.last_service_km}>
                <NumberInput id="last_service_km" value={f.last_service_km} error={errors.last_service_km} onChange={(v) => set("last_service_km", v)} />
              </Field>
            </>
          ) : null}
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
