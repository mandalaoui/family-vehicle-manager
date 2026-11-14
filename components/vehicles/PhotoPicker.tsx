"use client";

import { useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compressImage, PhotoError } from "@/lib/image-compress";

// Two entry points: the camera (capture="environment" opens it on phones) and the gallery.
// The image is resized/compressed in the browser before anything is uploaded.
export function PhotoPicker({
  onPick,
  onError,
  disabled,
  iconOnly = false,
  cameraLabel = "צילום",
  galleryLabel = "בחירה מהגלריה",
}: {
  onPick: (photo: Blob) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** Small square icon buttons (label kept as aria-label/title). */
  iconOnly?: boolean;
  cameraLabel?: string;
  galleryLabel?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    try {
      onPick(await compressImage(file));
    } catch (err) {
      onError(err instanceof PhotoError ? err.message : "לא הצלחנו לעבד את התמונה. נסו תמונה אחרת.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={iconOnly ? "flex gap-2" : "flex flex-wrap gap-2"}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={handle} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={handle} />
      <Button
        variant="secondary"
        icon={Camera}
        loading={busy}
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        aria-label={iconOnly ? cameraLabel : undefined}
        title={iconOnly ? cameraLabel : undefined}
        className={iconOnly ? "w-11 px-0" : ""}
      >
        {iconOnly ? null : cameraLabel}
      </Button>
      <Button
        variant="neutral"
        icon={ImageIcon}
        disabled={disabled || busy}
        onClick={() => galleryRef.current?.click()}
        aria-label={iconOnly ? galleryLabel : undefined}
        title={iconOnly ? galleryLabel : undefined}
        className={iconOnly ? "w-11 px-0" : ""}
      >
        {iconOnly ? null : galleryLabel}
      </Button>
    </div>
  );
}
