"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { refreshFromMinistry } from "@/lib/actions/vehicles";
import { formatDate } from "@/lib/format";

export function RefreshMinistryButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const res = await refreshFromMinistry(vehicleId);
      if (!res.ok) {
        toast(res.error, { type: "error" });
        return;
      }
      toast(`תוקף הטסט והרישוי עודכן ממשרד התחבורה: ${formatDate(res.validUntil)}.`);
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" icon={Landmark} loading={pending} onClick={refresh} className="px-2 text-xs sm:text-sm">
      רענון ממשרד התחבורה
    </Button>
  );
}
