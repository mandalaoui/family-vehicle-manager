export function inviteDisplayStatus(status: string, expiresAt: string, now: number = Date.now()): "pending" | "expired" {
  return status === "pending" && new Date(expiresAt).getTime() > now ? "pending" : "expired";
}
