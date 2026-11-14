import "server-only";
import { mapMinistryRecord, type MinistryRecord, type MinistryVehicle } from "@/lib/ministry-map";

const ENDPOINT = "https://data.gov.il/api/3/action/datastore_search";
const RESOURCE_ID = "053cea08-09bc-40ec-8f7a-156f0677aff3";
const DAY = 86_400;

export type MinistryResult =
  | { status: "ok"; vehicle: MinistryVehicle }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * Looks a plate up in the public Ministry of Transport dataset (no API key).
 * Successful responses are cached for a day by the Next.js fetch cache; failures are never cached.
 */
export async function fetchMinistryVehicle(
  plate: string,
  opts: { timeoutMs?: number; fresh?: boolean } = {},
): Promise<MinistryResult> {
  if (!/^\d{7,8}$/.test(plate)) return { status: "not_found" };
  const url = new URL(ENDPOINT);
  url.searchParams.set("resource_id", RESOURCE_ID);
  url.searchParams.set("filters", JSON.stringify({ mispar_rechev: Number(plate) }));
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      headers: { Accept: "application/json" },
      ...(opts.fresh ? { cache: "no-store" as const } : { next: { revalidate: DAY } }),
    });
    if (!res.ok) return { status: "unavailable" };
    const body = (await res.json()) as { success?: boolean; result?: { records?: MinistryRecord[] } };
    if (!body.success) return { status: "unavailable" };
    const record = body.result?.records?.[0];
    if (!record) return { status: "not_found" };
    return { status: "ok", vehicle: mapMinistryRecord(record) };
  } catch {
    // timeout, network error or malformed JSON
    return { status: "unavailable" };
  }
}
