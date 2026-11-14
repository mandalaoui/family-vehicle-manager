"use client";

import { setVehiclePhoto } from "@/lib/actions/photos";
import { PHOTO_BUCKET, photoPath } from "@/lib/photo-path";

/** Uploads straight from the browser (storage RLS enforces the family folder), then records photo_path. */
export async function uploadVehiclePhoto(
  familyId: string,
  vehicleId: string,
  photo: Blob,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Loaded on demand: the browser Supabase client is the biggest script on these pages and is only
  // needed once a photo is actually uploaded.
  const { createClient } = await import("@/utils/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(photoPath(familyId, vehicleId), photo, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "60" // short: the file is replaced in place, so a long CDN cache would show the old photo,
  });
  if (error) return { ok: false, error: "העלאת התמונה נכשלה. בדקו את החיבור ונסו שוב." };
  const res = await setVehiclePhoto(vehicleId);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
