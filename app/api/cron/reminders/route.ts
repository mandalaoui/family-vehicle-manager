import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/reminders/cron-auth";

export const dynamic = "force-dynamic";

// Daily reminders endpoint (for Vercel Cron). It is OFF unless REMINDERS_ENABLED=1, and even then it
// needs the shared secret. The data source (a SECURITY DEFINER RPC, no service_role) is not wired yet:
// see docs/reminders.md. Until then an enabled call answers 501 and sends nothing.
export async function GET(request: Request) {
  if (process.env.REMINDERS_ENABLED !== "1") {
    return NextResponse.json({ ok: false, enabled: false }, { status: 404 });
  }
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: false, error: "reminder data source is not configured yet" }, { status: 501 });
}
