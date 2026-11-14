"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { EmptyState, ScreenHeader } from "@/components/ui/Layout";
import { Menu } from "@/components/ui/Menu";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { Ltr } from "@/components/ui/Plate";
import { useToast } from "@/components/ui/Toast";
import { createGarage, deleteGarage, updateGarage } from "@/lib/actions/garages";
import type { Garage } from "@/types/database";
import { GarageLinks } from "./GarageLinks";

function GarageForm({ garage, onClose }: { garage?: Garage; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ name: garage?.name ?? "", phone: garage?.phone ?? "", address: garage?.address ?? "", notes: garage?.notes ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((p) => {
      if (!(k in p)) return p;
      const n = { ...p };
      delete n[k];
      return n;
    });
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = garage ? await updateGarage(garage.id, f) : await createGarage(f);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.fieldErrors ? "יש לתקן את השדות המסומנים." : res.error, { type: "error" });
        return;
      }
      toast(garage ? "המוסך עודכן." : "המוסך נוסף לרשימה.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      title={garage ? "עריכת מוסך" : "הוספת מוסך"}
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" form="garage-form" icon={Check} loading={pending}>
            שמירה
          </Button>
        </>
      }
    >
      <form id="garage-form" onSubmit={submit} noValidate className="grid gap-4">
        <Field id="g-name" label="שם המוסך" error={errors.name}>
          <TextInput id="g-name" maxLength={80} value={f.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field id="g-phone" label="טלפון" error={errors.phone} hint="אפשר להשאיר ריק">
          <TextInput id="g-phone" ltr inputMode="tel" autoComplete="off" maxLength={30} value={f.phone} error={errors.phone} onChange={(e) => set("phone", e.target.value)} placeholder="03-1234567" />
        </Field>
        <Field id="g-address" label="כתובת" error={errors.address} hint="משמשת לניווט. אם ריק, מחפשים לפי שם המוסך.">
          <TextInput id="g-address" maxLength={200} value={f.address} error={errors.address} onChange={(e) => set("address", e.target.value)} placeholder="רחוב ועיר" />
        </Field>
        <Field id="g-notes" label="הערות" error={errors.notes}>
          <TextArea id="g-notes" rows={3} maxLength={1000} value={f.notes} error={errors.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

type ModalState = { kind: "add" } | { kind: "edit"; garage: Garage } | { kind: "delete"; garage: Garage } | null;

export function GarageManager({ garages, isAdmin }: { garages: Garage[]; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(g: Garage) {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteGarage(g.id);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      toast(`״${g.name}״ נמחק מהרשימה.`);
      setModal(null);
      router.refresh();
    });
  }

  return (
    <>
      <ScreenHeader title="מוסכים" subtitle={`${garages.length} מוסכים ברשימה המשפחתית`}>
        <Button icon={Plus} onClick={() => setModal({ kind: "add" })} className="w-full sm:w-auto">
          הוספת מוסך
        </Button>
      </ScreenHeader>

      {garages.length === 0 ? (
        <EmptyState icon={Wrench} title="עדיין אין מוסכים ברשימה">
          הוסיפו את המוסכים שבהם אתם מטפלים, כדי להתקשר, לנווט ולקשר אותם לטיפולים.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {garages.map((g) => (
            <li key={g.id} className="flex flex-col gap-3 rounded-2xl border border-silver-300 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-bold">{g.name}</h2>
                  {g.phone ? (
                    <p className="text-sm text-muted">
                      <Ltr>{g.phone}</Ltr>
                    </p>
                  ) : null}
                  {g.address ? <p className="break-words text-sm text-muted">{g.address}</p> : null}
                </div>
                <Menu
                  label={`פעולות עבור ${g.name}`}
                  items={[
                    { label: "עריכה", icon: Pencil, onClick: () => setModal({ kind: "edit", garage: g }) },
                    ...(isAdmin ? [{ label: "מחיקה", icon: Trash2, danger: true, onClick: () => setModal({ kind: "delete", garage: g }) }] : []),
                  ]}
                />
              </div>
              {g.notes ? <p className="whitespace-pre-wrap break-words text-sm">{g.notes}</p> : null}
              <GarageLinks garage={g} />
            </li>
          ))}
        </ul>
      )}

      {modal?.kind === "add" ? <GarageForm onClose={() => setModal(null)} /> : null}
      {modal?.kind === "edit" ? <GarageForm key={modal.garage.id} garage={modal.garage} onClose={() => setModal(null)} /> : null}
      {modal?.kind === "delete" ? (
        <ConfirmModal
          title="מחיקת מוסך"
          danger
          confirmLabel="מחיקה"
          pending={pending}
          error={deleteError}
          onClose={() => setModal(null)}
          onConfirm={() => remove(modal.garage)}
          body={`למחוק את ״${modal.garage.name}״ מהרשימה? הטיפולים שכבר נרשמו אצלו יישארו, עם שם המוסך.`}
        />
      ) : null}
    </>
  );
}
