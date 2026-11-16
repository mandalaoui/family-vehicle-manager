"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/ui/Toast";
import { acceptInvitation } from "@/lib/actions/family";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvitation(token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast("הצטרפתם.");
      router.replace("/home");
      router.refresh();
    });
  }

  return (
    <>
      <Button loading={pending} onClick={accept} className="w-full">
        הצטרפות
      </Button>
      {error ? (
        <Notice tone="error" icon={TriangleAlert} role="alert">
          {error}
        </Notice>
      ) : null}
    </>
  );
}
