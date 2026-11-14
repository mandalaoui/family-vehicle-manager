import { NextResponse } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Optional: return to a page (e.g. an invite link) after signing in with another account.
  let next = "/";
  try {
    const form = await request.formData();
    const value = form.get("next");
    if (typeof value === "string") next = safeNext(value);
  } catch {
    // no form body
  }
  const url = new URL("/login", request.url);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, { status: 303 });
}
