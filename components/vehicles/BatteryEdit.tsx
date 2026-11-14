"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BatteryVehicle } from "./BatteryModal";

// The modal (and, for tires, the diagram editor) is only downloaded when the button is pressed.
const BatteryModal = dynamic(() => import("./BatteryModal").then((m) => m.BatteryModal));

/** Edit button for the battery card; opens a focused modal (no page navigation). */
export function BatteryEdit({ vehicle }: { vehicle: BatteryVehicle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neutral" icon={Pencil} onClick={() => setOpen(true)} aria-label="עריכת פרטי המצבר">
        עריכה
      </Button>
      {open ? <BatteryModal vehicle={vehicle} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
