import { NextResponse } from "next/server";
import { getFamilyContext } from "@/lib/server/context";
import { getSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

// Self-service diagnostics for "why does this device show different data?". Signed-in users only
// (the proxy redirects anonymous requests). Shows which backend this deployment talks to and what the
// current account sees. Never returns keys, tokens or other users' data; ids are shortened.
export const dynamic = "force-dynamic";

const tail = (id: string | undefined) => (id ? `…${id.slice(-6)}` : null);

export async function GET() {
  // Development only: in production this route does not exist.
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const ctx = await getFamilyContext();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { url } = getSupabaseEnv();
  const supabase = await createClient();
  const [{ data: memberships }, { count: vehicleCount }] = await Promise.all([
    supabase.from("family_members").select("family_id, role"),
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      supabaseHost: new URL(url).hostname,
      deployment: {
        env: process.env.VERCEL_ENV ?? "local",
        region: process.env.VERCEL_REGION ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        node: process.env.NODE_ENV,
      },
      account: { userId: tail(ctx.user.id), memberships: (memberships ?? []).map((m) => ({ family: tail(m.family_id), role: m.role })) },
      activeFamily: tail(ctx.membership?.familyId),
      vehiclesVisible: vehicleCount ?? 0,
      serverTime: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
