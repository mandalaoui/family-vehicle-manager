// fetch wrapper for server-side Supabase calls. Family data is per user and per request, so it must
// never come from the Next.js fetch/data cache (older Next versions cached GET requests by default).
// With DEBUG_TIMING=1 it also logs every Supabase round trip (method, path, ms) for performance work.
export async function noStoreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (process.env.DEBUG_TIMING !== "1") return fetch(input, { ...init, cache: "no-store" });
  const started = performance.now();
  const res = await fetch(input, { ...init, cache: "no-store" });
  try {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    console.log(`[sb] ${(init?.method ?? "GET").padEnd(4)} ${url.pathname} ${Math.round(performance.now() - started)}ms`);
  } catch {
    // logging only
  }
  return res;
}
