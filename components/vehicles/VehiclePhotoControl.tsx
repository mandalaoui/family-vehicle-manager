"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { removeVehiclePhoto } from "@/lib/actions/photos";
import { uploadVehiclePhoto } from "@/lib/upload-photo";
import { PhotoPicker } from "./PhotoPicker";

export function VehiclePhotoControl({ vehicleId, familyId, hasPhoto }: { vehicleId: string; familyId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onPick(photo: Blob) {
    setUploading(true);
    const res = await uploadVehiclePhoto(familyId, vehicleId, photo);
    setUploading(false);
    if (!res.ok) {
      toast(res.error, { type: "error" });
      return;
    }
    toast(hasPhoto ? "התמונה הוחלפה." : "התמונה נוספה.");
    router.refresh();
  }

  function remove() {
    startTransition(async () => {
      const res = await removeVehiclePhoto(vehicleId);
      if (!res.ok) {
        toast(res.error, { type: "error" });
        return;
      }
      toast("התמונה הוסרה.", { type: "info" });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2" aria-busy={uploading}>
      <PhotoPicker
        iconOnly
        disabled={uploading || pending}
        onPick={onPick}
        onError={(m) => toast(m, { type: "error" })}
        cameraLabel={hasPhoto ? "צילום חדש" : "צילום"}
        galleryLabel="בחירה מהגלריה"
      />
      {hasPhoto ? (
        <Button variant="ghost" icon={Trash2} loading={pending} disabled={uploading} onClick={remove} aria-label="הסרת תמונה" title="הסרת תמונה" className="w-11 px-0 text-red-700 hover:bg-red-50" />
      ) : null}
    </div>
  );
}
