import Link from "next/link";

export const LEGAL_UPDATED = "15.11.2026";
export const CONTACT_EMAIL = "mandalaoui.omer@gmail.com";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <article className="rounded-2xl border border-silver-300 bg-white p-6 shadow-sm sm:p-8 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mb-1 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:pe-5">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">עודכן לאחרונה: {LEGAL_UPDATED}</p>
        {children}
      </article>
      <nav className="mt-4 flex justify-center gap-4 text-sm text-muted" aria-label="ניווט">
        <Link href="/login" className="underline">
          התחברות
        </Link>
        <Link href="/privacy" className="underline">
          פרטיות
        </Link>
        <Link href="/terms" className="underline">
          תנאי שימוש
        </Link>
      </nav>
    </main>
  );
}
