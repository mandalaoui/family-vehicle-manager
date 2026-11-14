import { timingSafeEqual } from "node:crypto";

/** True only for "Authorization: Bearer <CRON_SECRET>" (what Vercel Cron sends). Constant-time compare. */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
