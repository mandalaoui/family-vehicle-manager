"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut, Shield, Trash2, TriangleAlert, Users } from "lucide-react";
import { Notice } from "@/components/ui/Layout";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ConfirmModal } from "@/components/ui/Modal";
import { Ltr } from "@/components/ui/Plate";
import { useToast } from "@/components/ui/Toast";
import { changeMemberRole, leaveFamily, removeMember } from "@/lib/actions/family";
import { ROLE_LABELS } from "@/lib/format";
import type { Role } from "@/types/database";

export interface MemberView {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  isYou: boolean;
}

export function MembersList({ members, isAdmin }: { members: MemberView[]; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MemberView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleRole(m: MemberView) {
    setError(null);
    const next: Role = m.role === "admin" ? "member" : "admin";
    startTransition(async () => {
      const res = await changeMemberRole(m.userId, next);
      if (!res.ok) {
        setError(res.error);
        toast(res.error, { type: "error" });
        return;
      }
      toast(`${m.name} הוגדר/ה כ${ROLE_LABELS[next]}.`);
      router.refresh();
    });
  }

  function confirmRemove() {
    if (!removing) return;
    setModalError(null);
    const m = removing;
    startTransition(async () => {
      const res = await removeMember(m.userId);
      if (!res.ok) {
        setModalError(res.error);
        setError(res.error);
        return;
      }
      toast(`${m.name} הוסר/ה.`);
      setRemoving(null);
      router.refresh();
    });
  }

  function confirmLeave() {
    setModalError(null);
    startTransition(async () => {
      const res = await leaveFamily();
      if (!res.ok) {
        setModalError(res.error);
        setError(res.error);
        return;
      }
      toast("עזבתם את השיתוף.", { type: "info" });
      router.replace("/home");
      router.refresh();
    });
  }

  function menuFor(m: MemberView): MenuItem[] {
    const items: MenuItem[] = [];
    if (isAdmin) {
      items.push({
        label: m.role === "admin" ? "הפיכה למשתתף" : "הפיכה למנהל",
        icon: Shield,
        onClick: () => toggleRole(m),
      });
    }
    if (m.isYou) {
      items.push({ label: "עזיבת השיתוף", icon: LogOut, danger: true, onClick: () => { setModalError(null); setLeaving(true); } });
    } else if (isAdmin) {
      items.push({ label: "הסרה", icon: Trash2, danger: true, onClick: () => { setModalError(null); setRemoving(m); } });
    }
    return items;
  }

  return (
    <>
      {error ? (
        <div className="mb-3">
          <Notice tone="error" icon={TriangleAlert} role="alert">
            {error}
          </Notice>
        </div>
      ) : null}
      <ul className="divide-y divide-silver-200" aria-busy={pending}>
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 font-bold text-brand" aria-hidden>
              {m.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {m.name}
                {m.isYou ? <span className="ms-2 text-xs font-medium text-muted">(את/ה)</span> : null}
              </p>
              {m.email ? (
                <p className="truncate text-sm text-muted">
                  <Ltr>{m.email}</Ltr>
                </p>
              ) : null}
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                m.role === "admin" ? "border-brand bg-brand-50 text-brand" : "border-silver-300 bg-silver-50 text-ink"
              }`}
            >
              {m.role === "admin" ? <Shield size={14} aria-hidden /> : <Users size={14} aria-hidden />}
              {ROLE_LABELS[m.role]}
            </span>
            <Menu label={`פעולות עבור ${m.name}`} items={menuFor(m)} />
          </li>
        ))}
      </ul>

      {removing ? (
        <ConfirmModal
          title="הסרת משתתף"
          danger
          confirmLabel="הסרה"
          pending={pending}
          error={modalError}
          onClose={() => setRemoving(null)}
          onConfirm={confirmRemove}
          body={`להסיר את ${removing.name}? לא תהיה לו/ה יותר גישה לרכבים.`}
        />
      ) : null}
      {leaving ? (
        <ConfirmModal
          title="עזיבת השיתוף"
          danger
          confirmLabel="עזיבה"
          pending={pending}
          error={modalError}
          onClose={() => setLeaving(false)}
          onConfirm={confirmLeave}
          body="לעזוב את השיתוף? לא תהיה לכם יותר גישה לרכבים של שאר המשתתפים."
        />
      ) : null}
    </>
  );
}
