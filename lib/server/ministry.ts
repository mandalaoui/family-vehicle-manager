import "server-only";
import { unstable_cache } from "next/cache";
import { mapMinistryRecord, type MinistryRecord, type MinistryVehicle } from "@/lib/ministry-map";

const ENDPOINT = "https://data.gov.il/api/3/action/datastore_search";
const RESOURCE_ID = "053cea08-09bc-40ec-8f7a-156f0677aff3";
const DAY = 86_400;

export type MinistryResult =
  | { status: "ok"; vehicle: MinistryVehicle }
  | { status: "not_found" }
  | { status: "unavailable" };

async function queryMinistry(plate: string, timeoutMs: number): Promise<MinistryResult> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("resource_id", RESOURCE_ID);
  url.searchParams.set("filters", JSON.stringify({ mispar_rechev: Number(plate) }));
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
      cache: "no-store",
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

/** Thrown inside the cached function so that only successful lookups are stored. */
class NotCacheable extends Error {
  constructor(readonly result: MinistryResult) {
    super("not cacheable");
  }
}

// Only "ok" answers are cached (one day). "not_found" and "unavailable" are never cached, so a newly
// registered plate or a temporary outage does not stick for a day.
const cachedLookup = unstable_cache(
  async (plate: string) => {
    const result = await queryMinistry(plate, 8000);
    if (result.status !== "ok") throw new NotCacheable(result);
    return result;
  },
  ["ministry-vehicle"],
  { revalidate: DAY },
);

/** Looks a plate up in the public Ministry of Transport dataset (no API key). */
export async function fetchMinistryVehicle(
  plate: string,
  opts: { timeoutMs?: number; fresh?: boolean } = {},
): Promise<MinistryResult> {
  if (!/^\d{7,8}$/.test(plate)) return { status: "not_found" };
  if (opts.fresh || opts.timeoutMs) return queryMinistry(plate, opts.timeoutMs ?? 8000);
  try {
    return await cachedLookup(plate);
  } catch (err) {
    if (err instanceof NotCacheable) return err.result;
    // Unexpected cache-layer error: fall back to a direct, uncached lookup.
    return queryMinistry(plate, 8000);
  }
}
