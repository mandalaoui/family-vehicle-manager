import type { createClient } from "@/utils/supabase/server";
import { PHOTO_BUCKET } from "@/lib/photo-path";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Signed (1 hour) URLs for private photos, keyed by storage path. Missing/forbidden objects are skipped. */
export async function signedPhotoUrls(supabase: Supabase, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
