"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TiresVehicle } from "./TiresModal";

// The modal (and, for tires, the diagram editor) is only downloaded when the button is pressed.
const TiresModal = dynamic(() => import("./TiresModal").then((m) => m.TiresModal));

/** Edit button for the tires card; opens a focused modal (no page navigation). */
export function TiresEdit({ vehicle }: { vehicle: TiresVehicle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neutral" icon={Pencil} onClick={() => setOpen(true)} aria-label="עריכת פרטי הצמיגים">
        עריכה
      </Button>
      {open ? <TiresModal vehicle={vehicle} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
