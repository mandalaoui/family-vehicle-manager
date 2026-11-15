import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    // Cron has no session cookie; the route itself requires REMINDERS_ENABLED and a bearer secret.
    pathname === "/api/cron/reminders" ||
    pathname === "/invite" ||
    pathname.startsWith("/invite/")
  );
}

// Refreshes the auth cookies on every request and redirects anonymous visitors to /login.
// Uses getUser() (verified with the Auth server), never getSession().
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    const next = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (next !== "/") loginUrl.searchParams.set("next", next);
    const redirect = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return supabaseResponse;
}
