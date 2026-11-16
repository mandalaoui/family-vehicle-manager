"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link as LinkIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Section } from "@/components/ui/Layout";
import { useToast } from "@/components/ui/Toast";
import { createFamily } from "@/lib/actions/family";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** Accepts a full invite link or the bare token. */
export function extractInviteToken(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  let candidate = value;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    candidate = parts[parts.length - 1] ?? "";
  } catch {
    candidate = value.split(/[/?#]/).filter(Boolean).pop() ?? "";
  }
  return TOKEN_RE.test(candidate) ? candidate : null;
}

export function OnboardingForms() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    setNameError(undefined);
    startTransition(async () => {
      const res = await createFamily(name);
      if (!res.ok) {
        setNameError(res.fieldErrors?.name ?? res.error);
        toast(res.error, { type: "error" });
        return;
      }
      toast("המשפחה נוצרה. עכשיו אפשר להוסיף רכב ראשון.");
      router.replace("/home");
      router.refresh();
    });
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const token = extractInviteToken(link);
    if (!token) {
      setLinkError("הדביקו את קישור ההזמנה המלא או את הקוד שקיבלתם ממנהל המשפחה.");
      return;
    }
    setLinkError(undefined);
    router.push(`/invite/${token}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Section icon={Users} title="פתיחת משפחה חדשה">
        <form onSubmit={create} noValidate className="flex flex-col gap-3">
          <Field id="family-name" label="שם המשפחה" error={nameError} hint="למשל: משפחת כהן. אפשר לשנות אחר כך.">
            <TextInput id="family-name" value={name} error={nameError} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="משפחת כהן" />
          </Field>
          <Button type="submit" loading={pending} className="self-start">
            יצירת משפחה
          </Button>
        </form>
      </Section>

      <Section icon={LinkIcon} title="הצטרפות עם הזמנה">
        <form onSubmit={join} noValidate className="flex flex-col gap-3">
          <Field id="invite-link" label="קישור הזמנה" error={linkError} hint="הקישור נשלח אליכם ממנהל המשפחה. צריך להתחבר עם כתובת ה־Google שאליה נשלחה ההזמנה.">
            <TextInput id="invite-link" ltr value={link} error={linkError} onChange={(e) => setLink(e.target.value)} placeholder="https://…/invite/…" />
          </Field>
          <Button type="submit" variant="secondary" className="self-start">
            המשך להצטרפות
          </Button>
        </form>
      </Section>
    </div>
  );
}
