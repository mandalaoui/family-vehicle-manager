// fetch wrapper for server-side Supabase calls. Family data is per user and per request, so it must
// never come from the Next.js fetch/data cache (older Next versions cached GET requests by default).
export function noStoreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}
