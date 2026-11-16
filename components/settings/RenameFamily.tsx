"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { renameFamily } from "@/lib/actions/family";

export function RenameFamily({ name }: { name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await renameFamily(value);
      if (!res.ok) {
        setError(res.fieldErrors?.name ?? res.error);
        toast(res.error, { type: "error" });
        return;
      }
      toast("השם עודכן.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field id="family-rename" label="שם השיתוף" error={error}>
        <TextInput id="family-rename" value={value} error={error} maxLength={60} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Button type="submit" icon={Check} loading={pending} disabled={value.trim() === name} className="self-start">
        שמירה
      </Button>
    </form>
  );
}
