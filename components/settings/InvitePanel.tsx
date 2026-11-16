"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock, Copy, Mail, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Ltr } from "@/components/ui/Plate";
import { useToast } from "@/components/ui/Toast";
import { createInvitation, revokeInvitation } from "@/lib/actions/family";
import { formatDate, ROLE_LABELS } from "@/lib/format";
import { useOrigin } from "@/lib/use-origin";
import type { Role } from "@/types/database";

export interface InviteView {
  id: string;
  email: string;
  role: Role;
  token: string;
  status: "pending" | "expired";
  expiresAt: string; // ISO date
}

function LinkBox({ link, onCopy }: { link: string; onCopy: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-green-300 bg-green-50 p-3">
      <p className="text-sm font-semibold text-green-900">ההזמנה נוצרה. שלחו את הקישור למשתתף (לא נשלח אימייל):</p>
      <p dir="ltr" className="select-all break-all rounded-lg border border-green-300 bg-white p-2 text-start text-sm">
        {link}
      </p>
      <Button variant="secondary" icon={Copy} onClick={onCopy} className="self-start">
        העתקת קישור
      </Button>
    </div>
  );
}

export function InvitePanel({ invites }: { invites: InviteView[] }) {
  const router = useRouter();
  const toast = useToast();
  const origin = useOrigin();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [emailError, setEmailError] = useState<string>();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const linkFor = (token: string) => `${origin}/invite/${token}`;

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast("הקישור הועתק.");
    } catch {
      toast("לא הצלחנו להעתיק אוטומטית. סמנו את הקישור והעתיקו אותו ידנית.", { type: "info" });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setNewToken(null);
    startTransition(async () => {
      const res = await createInvitation(email, role);
      if (!res.ok) {
        setEmailError(res.fieldErrors?.email ?? res.error);
        toast(res.error, { type: "error" });
        return;
      }
      setNewToken(res.token);
      setEmail("");
      toast("ההזמנה נוצרה. העתיקו את הקישור ושלחו אותו.");
      router.refresh();
    });
  }

  function revoke(i: InviteView) {
    startTransition(async () => {
      const res = await revokeInvitation(i.id);
      if (!res.ok) {
        toast(res.error, { type: "error" });
        return;
      }
      if (newToken === i.token) setNewToken(null);
      toast("ההזמנה בוטלה.", { type: "info" });
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field id="invite-email" label="כתובת Google של המשתתף" error={emailError} hint="ההזמנה תעבוד רק עם חשבון Google בכתובת הזאת. תוקף ההזמנה: 7 ימים.">
          <TextInput id="invite-email" ltr type="email" autoComplete="off" placeholder="name@gmail.com" value={email} error={emailError} onChange={(e) => { setEmail(e.target.value); setEmailError(undefined); }} />
        </Field>
        <Field id="invite-role" label="תפקיד">
          <SelectInput
            id="invite-role"
            value={role}
            onChange={(v) => setRole(v === "admin" ? "admin" : "member")}
            options={[
              { value: "member", label: ROLE_LABELS.member },
              { value: "admin", label: ROLE_LABELS.admin },
            ]}
            placeholder="בחירת תפקיד"
          />
        </Field>
        <Button type="submit" icon={Mail} loading={pending} className="self-start">
          יצירת הזמנה
        </Button>
      </form>

      {newToken && origin ? (
        <div className="mt-4">
          <LinkBox link={linkFor(newToken)} onCopy={() => copy(newToken)} />
        </div>
      ) : null}

      <h3 className="mb-1 mt-5 text-sm font-bold">הזמנות ממתינות</h3>
      {invites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-silver-300 bg-silver-50 p-3 text-sm text-muted">אין הזמנות ממתינות.</p>
      ) : (
        <ul className="divide-y divide-silver-200">
          {invites.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    <Ltr>{i.email}</Ltr>
                  </p>
                  <p className="text-xs text-muted">
                    {ROLE_LABELS[i.role]} · {i.status === "pending" ? "בתוקף עד" : "פג ב־"} <Ltr>{formatDate(i.expiresAt)}</Ltr>
                  </p>
                </div>
                {i.status === "pending" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                    <Clock size={14} aria-hidden />
                    ממתינה
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-800">
                    <TriangleAlert size={14} aria-hidden />
                    פג תוקף
                  </span>
                )}
                <Menu
                  label={`פעולות עבור ההזמנה ל־${i.email}`}
                  items={[
                    ...(i.status === "pending" ? [{ label: "העתקת קישור", icon: Copy, onClick: () => copy(i.token) }] : []),
                    { label: "ביטול הזמנה", icon: X, danger: true, onClick: () => revoke(i) },
                  ]}
                />
              </div>
              {i.status === "pending" && origin ? (
                <p dir="ltr" className="select-all break-all rounded-lg border border-silver-300 bg-silver-50 p-2 text-start text-xs">
                  {linkFor(i.token)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
