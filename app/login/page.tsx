import Link from "next/link";
import { redirect } from "next/navigation";
import { Car, TriangleAlert } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Notice } from "@/components/ui/Layout";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/lib/server/context";

export const metadata = { title: "התחברות · ניהול רכבי המשפחה" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-silver-300 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white">
            <Car size={30} aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">ניהול רכבי המשפחה</h1>
          <p className="text-sm text-muted">רישוי, טיפולים וקילומטראז׳ של כל הרכבים, במקום אחד לכל המשפחה.</p>
        </div>
        {params.error ? (
          <div className="mb-4">
            <Notice tone="error" icon={TriangleAlert} role="alert">
              ההתחברות עם Google לא הושלמה. נסו שוב.
            </Notice>
          </div>
        ) : null}
        <GoogleSignInButton next={next} />
        <p className="mt-4 text-center text-xs text-muted">ההתחברות נעשית רק דרך חשבון Google. אנחנו לא שומרים סיסמאות.</p>
      </div>
      <footer className="mt-4 flex justify-center gap-4 text-xs text-muted">
        <Link href="/privacy" className="underline">
          פרטיות
        </Link>
        <Link href="/terms" className="underline">
          תנאי שימוש
        </Link>
      </footer>
    </main>
  );
}
