import { NextResponse } from "next/server";
import { MINISTRY_NOT_FOUND, MINISTRY_UNAVAILABLE } from "@/lib/errors";
import { fetchMinistryVehicle } from "@/lib/server/ministry";
import { getCurrentUser } from "@/lib/server/context";
import { plateField } from "@/lib/validation";


// Signed-in users only, so this cannot be used as an open proxy.
export async function GET(_req: Request, { params }: { params: Promise<{ plate: string }> }) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ ok: false, code: "unauthenticated", error: "ההתחברות פגה. התחברו שוב." }, { status: 401 });
  }
  const { plate: raw } = await params;
  const plate = plateField.safeParse(raw);
  if (!plate.success) {
    return NextResponse.json({ ok: false, code: "invalid", error: "מספר רכב תקין כולל 7 או 8 ספרות" }, { status: 400 });
  }

  const result = await fetchMinistryVehicle(plate.data);
  if (result.status === "ok") return NextResponse.json({ ok: true, vehicle: result.vehicle });
  if (result.status === "not_found") {
    return NextResponse.json({ ok: false, code: "not_found", error: MINISTRY_NOT_FOUND }, { status: 404 });
  }
  return NextResponse.json({ ok: false, code: "unavailable", error: MINISTRY_UNAVAILABLE }, { status: 504 });
}
