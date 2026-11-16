// Only same-site relative paths are allowed as post-login destinations.
// Blocks "//host", "/\host", absolute URLs and control characters.
export function safeNext(value: string | null | undefined, fallback = "/home"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "http://local.invalid";
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
